import { useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type NoulAnswer = {
  type: "noul";
  noul: number;
};

type ChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

type ScoreAnswer = {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
};

type ClassifyResponse = {
  model: string;
  answers: {
    is_spam: NoulAnswer;
    is_phishing: NoulAnswer;
    asks_credentials: NoulAnswer;
    category: ChoiceAnswer;
    risk: ScoreAnswer;
  };
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  elapsedMs: number;
};

type Sample = {
  label: string;
  sender: string;
  text: string;
};

const SAMPLES: Sample[] = [
  {
    label: "Phishing",
    sender: "BANK-ALERT",
    text: "URGENT: Your account will be locked today. Verify now at http://secure-update.example to keep access.",
  },
  {
    label: "OTP",
    sender: "Auth",
    text: "Your verification code is 482913. Do not share this code with anyone.",
  },
  {
    label: "Promo",
    sender: "ShopDeals",
    text: "FLASH SALE: 40% off everything this weekend only. Reply STOP to unsubscribe.",
  },
  {
    label: "Delivery",
    sender: "ParcelCo",
    text: "Your package #A18422 is out for delivery today between 2–6pm.",
  },
];

const CATEGORIES = [
  "otp",
  "transactional",
  "promotional",
  "personal",
  "scam",
  "other",
] as const;

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function riskLevel(score: number): "safe" | "caution" | "danger" {
  if (score >= 1.45) return "danger";
  if (score >= 0.75) return "caution";
  return "safe";
}

function verdictTitle(level: "safe" | "caution" | "danger") {
  if (level === "danger") return "High risk";
  if (level === "caution") return "Needs caution";
  return "Looks safe";
}

function meterTone(value: number): "" | "caution" | "danger" {
  if (value >= 0.65) return "danger";
  if (value >= 0.35) return "caution";
  return "";
}

function App() {
  const [sender, setSender] = useState("");
  const [text, setText] = useState(SAMPLES[0]?.text ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClassifyResponse | null>(null);

  function applySample(sample: Sample) {
    setSender(sample.sender);
    setText(sample.text);
    setError(null);
  }

  async function classify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          sender: sender.trim() || undefined,
        }),
      });

      const data = (await response.json()) as ClassifyResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Classification failed");
      }

      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const answers = result?.answers;
  const level = answers ? riskLevel(answers.risk.score) : "safe";

  return (
    <div className="app">
      <header className="hero">
        <p className="brand">Laya</p>
        <div className="hero-copy">
          <h1>Classify SMS. Catch spam.</h1>
          <p>
            Paste a message and Laya scores spam, phishing, category, and risk
            in one pass — calibrated probabilities, no generated text.
          </p>
        </div>
      </header>

      <div className="workspace">
        <form className="composer" onSubmit={classify}>
          <div className="composer-label">
            <strong>Compose SMS</strong>
            <span>{text.length}/2000</span>
          </div>

          <div className="field">
            <label htmlFor="sender">Sender (optional)</label>
            <input
              id="sender"
              value={sender}
              onChange={function (event) {
                setSender(event.target.value);
              }}
              placeholder="BANK-ALERT, Auth, +1555…"
              maxLength={80}
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label htmlFor="sms">Message</label>
            <textarea
              id="sms"
              value={text}
              onChange={function (event) {
                setText(event.target.value);
              }}
              placeholder="Paste an SMS to classify…"
              maxLength={2000}
              required
            />
          </div>

          <div className="samples">
            {SAMPLES.map(function (sample) {
              return (
                <button
                  key={sample.label}
                  type="button"
                  onClick={function () {
                    applySample(sample);
                  }}
                >
                  {sample.label}
                </button>
              );
            })}
          </div>

          <div className="actions">
            <button type="submit" disabled={loading || !text.trim()}>
              {loading ? "Classifying…" : "Classify with Laya"}
            </button>
            <span className="hint">Local model · systemone</span>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </form>

        <section className="results" aria-live="polite">
          {!answers ? (
            <div className="results-empty">
              <div>
                <strong>Waiting for a message</strong>
                Results for spam, phishing, category, and risk show up here.
              </div>
            </div>
          ) : (
            <div className="verdict">
              <div className="verdict-banner" data-level={level}>
                <div>
                  <h2>{verdictTitle(level)}</h2>
                  <p>
                    Category: {answers.category.choice} · risk score{" "}
                    {answers.risk.score.toFixed(2)}
                  </p>
                </div>
                <div className="meta">
                  {result.elapsedMs} ms
                  <br />
                  {result.usage.input_tokens} tokens
                </div>
              </div>

              <div className="meters">
                <Meter
                  label="Spam"
                  value={answers.is_spam.noul}
                  tone={meterTone(answers.is_spam.noul)}
                />
                <Meter
                  label="Phishing"
                  value={answers.is_phishing.noul}
                  tone={meterTone(answers.is_phishing.noul)}
                />
                <Meter
                  label="Asks for credentials"
                  value={answers.asks_credentials.noul}
                  tone={meterTone(answers.asks_credentials.noul)}
                />
              </div>

              <div className="category-row">
                <h3>Category</h3>
                <div className="chips">
                  {CATEGORIES.map(function (category) {
                    const active = answers.category.choice === category;
                    const probability =
                      answers.category.probabilities[category] ?? 0;

                    return (
                      <span
                        key={category}
                        className="chip"
                        data-active={active ? "true" : "false"}
                        title={pct(probability)}
                      >
                        {category}
                        {active ? ` · ${pct(probability)}` : ""}
                      </span>
                    );
                  })}
                </div>
                <p className="risk-note">
                  Confidence {pct(answers.category.confidence)}. Risk levels:{" "}
                  {Object.entries(answers.risk.legend)
                    .map(function ([key, label]) {
                      const probability =
                        answers.risk.probabilities[key] ?? 0;
                      return `${label} (${pct(probability)})`;
                    })
                    .join(" · ")}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Meter(props: {
  label: string;
  value: number;
  tone: "" | "caution" | "danger";
}) {
  return (
    <div className="meter">
      <div className="meter-head">
        <strong>{props.label}</strong>
        <span>{pct(props.value)}</span>
      </div>
      <div className="track">
        <div
          className={`fill ${props.tone}`.trim()}
          style={{ width: pct(props.value) }}
        />
      </div>
    </div>
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element #root not found");
}

createRoot(root).render(<App />);
