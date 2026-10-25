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

type CategoryKey =
  | "otp"
  | "transactional"
  | "promotional"
  | "personal"
  | "scam"
  | "other";

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  otp: "رمز یک‌بارمصرف",
  transactional: "تراکنشی",
  promotional: "تبلیغاتی",
  personal: "شخصی",
  scam: "کلاهبرداری",
  other: "سایر",
};

const RISK_LABELS: Record<string, string> = {
  "0": "امن",
  "1": "مشکوک",
  "2": "خطرناک",
};

const SAMPLES: Sample[] = [
  {
    label: "فیشینگ",
    sender: "BANK-ALERT",
    text: "فوری: حساب شما امروز مسدود می‌شود. برای تأیید همین حالا وارد شوید: http://secure-update.example",
  },
  {
    label: "رمز یک‌بارمصرف",
    sender: "بانک",
    text: "کد تأیید شما ۴۸۲۹۱۳ است. این کد را در اختیار کسی قرار ندهید.",
  },
  {
    label: "تبلیغات",
    sender: "ShopDeals",
    text: "فروش ویژه: تا ۴۰٪ تخفیف فقط این آخر هفته. برای لغو عضویت STOP بفرستید.",
  },
  {
    label: "ارسال مرسوله",
    sender: "پست",
    text: "مرسوله شماره A18422 امروز بین ۱۴ تا ۱۸ تحویل می‌شود.",
  },
];

const CATEGORIES = Object.keys(CATEGORY_LABELS) as CategoryKey[];

function pct(value: number) {
  return `${Math.round(value * 100)}٪`;
}

function widthPct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function riskLevel(score: number): "safe" | "caution" | "danger" {
  if (score >= 1.45) return "danger";
  if (score >= 0.75) return "caution";
  return "safe";
}

function verdictTitle(level: "safe" | "caution" | "danger") {
  if (level === "danger") return "ریسک بالا";
  if (level === "caution") return "نیاز به احتیاط";
  return "به‌نظر امن است";
}

function meterTone(value: number): "" | "caution" | "danger" {
  if (value >= 0.65) return "danger";
  if (value >= 0.35) return "caution";
  return "";
}

function categoryLabel(key: string) {
  return CATEGORY_LABELS[key as CategoryKey] ?? key;
}

function App() {
  const [sender, setSender] = useState(SAMPLES[0]?.sender ?? "");
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
        throw new Error(data.error ?? "طبقه‌بندی ناموفق بود");
      }

      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "خطایی رخ داد");
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
          <h1>پیامک را طبقه‌بندی کن. اسپم را پیدا کن.</h1>
          <p>
            متن پیام را بچسبانید؛ Laya در یک مرحله احتمال اسپم، فیشینگ، دسته و
            ریسک را با احتمال‌های کالیبره‌شده برمی‌گرداند — بدون تولید متن.
          </p>
        </div>
      </header>

      <div className="workspace">
        <form className="composer" onSubmit={classify}>
          <div className="composer-label">
            <strong>نوشتن پیامک</strong>
            <span>{text.length}/2000</span>
          </div>

          <div className="field">
            <label htmlFor="sender">فرستنده (اختیاری)</label>
            <input
              id="sender"
              value={sender}
              onChange={function (event) {
                setSender(event.target.value);
              }}
              placeholder="بانک، Auth، ۰۹۱۲…"
              maxLength={80}
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label htmlFor="sms">متن پیام</label>
            <textarea
              id="sms"
              value={text}
              onChange={function (event) {
                setText(event.target.value);
              }}
              placeholder="پیامک را برای طبقه‌بندی اینجا بچسبانید…"
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
              {loading ? "در حال طبقه‌بندی…" : "طبقه‌بندی با Laya"}
            </button>
            <span className="hint">مدل محلی · systemone</span>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </form>

        <section className="results" aria-live="polite">
          {!answers ? (
            <div className="results-empty">
              <div>
                <strong>منتظر پیام</strong>
                نتیجه اسپم، فیشینگ، دسته و ریسک اینجا نمایش داده می‌شود.
              </div>
            </div>
          ) : (
            <div className="verdict">
              <div className="verdict-banner" data-level={level}>
                <div>
                  <h2>{verdictTitle(level)}</h2>
                  <p>
                    دسته: {categoryLabel(answers.category.choice)} · امتیاز ریسک{" "}
                    {answers.risk.score.toFixed(2)}
                  </p>
                </div>
                <div className="meta">
                  {result.elapsedMs} میلی‌ثانیه
                  <br />
                  {result.usage.input_tokens} توکن
                </div>
              </div>

              <div className="meters">
                <Meter
                  label="اسپم"
                  value={answers.is_spam.noul}
                  tone={meterTone(answers.is_spam.noul)}
                />
                <Meter
                  label="فیشینگ"
                  value={answers.is_phishing.noul}
                  tone={meterTone(answers.is_phishing.noul)}
                />
                <Meter
                  label="درخواست اطلاعات حساس"
                  value={answers.asks_credentials.noul}
                  tone={meterTone(answers.asks_credentials.noul)}
                />
              </div>

              <div className="category-row">
                <h3>دسته</h3>
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
                        {CATEGORY_LABELS[category]}
                        {active ? ` · ${pct(probability)}` : ""}
                      </span>
                    );
                  })}
                </div>
                <p className="risk-note">
                  اطمینان دسته {pct(answers.category.confidence)}. سطوح ریسک:{" "}
                  {Object.keys(answers.risk.legend)
                    .map(function (key) {
                      const probability =
                        answers.risk.probabilities[key] ?? 0;
                      const label = RISK_LABELS[key] ?? answers.risk.legend[key];
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
          style={{ width: widthPct(props.value) }}
        />
      </div>
    </div>
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("عنصر ریشه #root پیدا نشد");
}

createRoot(root).render(<App />);
