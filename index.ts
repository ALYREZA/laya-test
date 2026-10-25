import index from "./index.html";
import ollama from "ollama";

const SAMPLE_LIMIT = 2000;

type ClassifyBody = {
  text?: unknown;
  sender?: unknown;
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

async function classifySms(req: Request) {
  let body: ClassifyBody;

  try {
    body = (await req.json()) as ClassifyBody;
  } catch {
    return json({ error: "بدنه درخواست نامعتبر است" }, 400);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const sender =
    typeof body.sender === "string" ? body.sender.trim() : undefined;

  if (!text) {
    return json({ error: "متن پیامک الزامی است" }, 400);
  }

  if (text.length > SAMPLE_LIMIT) {
    return json(
      { error: `متن پیامک باید کمتر از ${SAMPLE_LIMIT} کاراکتر باشد` },
      400,
    );
  }

  const state = {
    channel: "sms",
    ...(sender ? { sender } : {}),
    body: text,
  };

  const started = performance.now();

  try {
    const response = await ollama.systemone({
      model: "laya",
      state,
      questions: {
        is_spam: {
          type: "noul",
          instructions:
            "Is this SMS unsolicited spam, junk advertising, or bulk promo the user did not ask for?",
          criteria: {
            true: "Spam, junk, or unsolicited promotional SMS.",
            false: "Legitimate personal, transactional, or expected SMS.",
          },
        },
        is_phishing: {
          type: "noul",
          instructions:
            "Is this SMS a phishing or scam attempt that tries to steal money, credentials, OTPs, or personal data?",
          criteria: {
            true: "Phishing or scam intent is present.",
            false: "No phishing or scam intent.",
          },
        },
        asks_credentials: {
          type: "noul",
          instructions:
            "Does this SMS ask the recipient to share passwords, OTPs, PINs, bank details, or click a suspicious link to verify an account?",
        },
        category: {
          type: "choice",
          instructions: "What is the primary category of this SMS?",
          criteria: {
            otp: "One-time passcodes, verification codes, 2FA",
            banking:
              "Bank transfers, balance alerts, card activity, account notices from a bank",
            government:
              "Official or government messages (tax, ID, courts, municipalities, public agencies)",
            delivery: "Package shipping, courier, and delivery status updates",
            bill: "Utility bills, invoices, payment due reminders, top-ups",
            social:
              "Notifications from social networks or messaging apps (likes, follows, DMs, posts)",
            appointment: "Appointment, booking, reservation, or schedule reminders",
            transactional:
              "Other expected service alerts that are not banking, delivery, bill, or appointment",
            promotional: "Marketing, offers, sales, newsletters",
            family: "Messages from family members (parents, siblings, spouse, relatives)",
            friends: "Messages from friends or acquaintances",
            personal: "Messages from a person who is not clearly family or friends (e.g. coworkers)",
            scam: "Fraud, phishing, impersonation, social engineering",
            other: "Does not fit the categories above",
          },
        },
        risk: {
          type: "score",
          instructions: "How risky is this SMS for the recipient?",
          criteria: [
            "Safe — no meaningful risk",
            "Caution — slightly suspicious or unwanted",
            "Dangerous — likely scam, phishing, or harmful",
          ],
        },
      },
    });

    const elapsedMs = Math.round(performance.now() - started);

    return json({
      model: response.model,
      answers: response.answers,
      usage: response.usage,
      elapsedMs,
    });
  } catch (error) {
    console.error("Laya classify failed:", error);
    return json(
      {
        error:
          "اتصال به Ollama یا مدل Laya برقرار نشد. مطمئن شوید ollama serve در حال اجراست و مدل laya کشیده شده است.",
      },
      502,
    );
  }
}

const server = Bun.serve({
  port: 3000,
  routes: {
    "/": index,
    "/api/classify": {
      POST: classifySms,
    },
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Laya SMS lab → http://localhost:${server.port}`);
