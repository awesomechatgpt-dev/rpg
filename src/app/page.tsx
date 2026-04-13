'use client'; 
import { useState, useRef, useEffect } from "react";

const CLASSES = [
  { id: "knight", name: "Knight", desc: "Armored warrior sworn to honour", hp: 120, stats: { strength: 8, agility: 4, wisdom: 3 } },
  { id: "ranger", name: "Ranger", desc: "Stealthy hunter of wild and shadow", hp: 90, stats: { strength: 5, agility: 9, wisdom: 4 } },
  { id: "mage", name: "Mage", desc: "Scholar of arcane and forbidden arts", hp: 70, stats: { strength: 2, agility: 4, wisdom: 12 } },
  { id: "cleric", name: "Cleric", desc: "Servant of the divine, healer of wounds", hp: 100, stats: { strength: 4, agility: 4, wisdom: 9 } },
];

const SYSTEM_PROMPT = `You are a dark, serious medieval fantasy dungeon master. Your prose is vivid, immersive, and weighty — no humor, no levity. Describe the world with gritty realism: mud-caked roads, the smell of torch smoke, the weight of iron.

Rules:
- Always end your response with exactly 3 short action choices for the player, formatted as a JSON block at the very end like this:
{"choices":["Choice one","Choice two","Choice three"]}
- Keep narrative responses to 3-5 sentences before the choices.
- React to the player's class, stats, and history. Reference their name and class.
- Build tension. Every choice should feel consequential.
- Track HP changes in the narrative when combat or danger occurs. Indicate HP changes like: [HP: -15] or [HP: +10]
- Never break character.`;

export default function MedievalRPG() {
  const [screen, setScreen] = useState("create"); // create | game
  const [name, setName] = useState("");
  const [selectedClass, setSelectedClass] = useState(null);
  const [character, setCharacter] = useState(null);
  const [messages, setMessages] = useState([]);
  const [log, setLog] = useState([]);
  const [choices, setChoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hp, setHp] = useState(100);
  const [maxHp, setMaxHp] = useState(100);
  const [gold, setGold] = useState(10);
  const [xp, setXp] = useState(0);
  const [inventory, setInventory] = useState(["Worn sword", "Torch", "Rations x2"]);
  const logEndRef = useRef(null);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const startGame = async () => {
    if (!name.trim() || !selectedClass) return;
    const cls = CLASSES.find(c => c.id === selectedClass);
    const char = { name: name.trim(), cls };
    setCharacter(char);
    setHp(cls.hp);
    setMaxHp(cls.hp);
    setScreen("game");

    const intro = `The player is ${char.name}, a ${cls.name}. Stats: Strength ${cls.stats.strength}, Agility ${cls.stats.agility}, Wisdom ${cls.stats.wisdom}. HP: ${cls.hp}. Begin the adventure. Set the scene immediately — they have just arrived at the gates of a village in turmoil. Do not introduce yourself.`;
    await sendToAI([{ role: "user", content: intro }], char);
  };

  const parseResponse = (text) => {
    const jsonMatch = text.match(/\{"choices":\[.*?\]\}/s);
    let choices = [];
    let narrative = text;
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        choices = parsed.choices || [];
      } catch {}
      narrative = text.replace(jsonMatch[0], "").trim();
    }
    // Parse HP changes
    const hpMatches = [...narrative.matchAll(/\[HP:\s*([+-]\d+)\]/g)];
    let hpDelta = 0;
    hpMatches.forEach(m => { hpDelta += parseInt(m[1]); });
    narrative = narrative.replace(/\[HP:\s*[+-]\d+\]/g, "").trim();
    return { narrative, choices, hpDelta };
  };

  const sendToAI = async (msgs, char) => {
    setLoading(true);
    setChoices([]);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: msgs,
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const { narrative, choices: newChoices, hpDelta } = parseResponse(text);

      setLog(prev => [...prev, { role: "dm", text: narrative }]);
      setChoices(newChoices);
      setMessages(msgs.concat([{ role: "assistant", content: text }]));

      if (hpDelta !== 0) {
        setHp(prev => Math.max(0, Math.min(maxHp, prev + hpDelta)));
      }
    } catch (e) {
      setLog(prev => [...prev, { role: "dm", text: "The darkness swallows your path. Something went wrong." }]);
    }
    setLoading(false);
  };

  const handleChoice = async (choice) => {
    const newLog = [...log, { role: "player", text: choice }];
    setLog(newLog);
    const newMsgs = [...messages, { role: "user", content: choice }];
    setMessages(newMsgs);
    await sendToAI(newMsgs, character);
  };

  const hpPct = Math.max(0, (hp / maxHp) * 100);
  const hpColor = hpPct > 60 ? "#3B6D11" : hpPct > 30 ? "#BA7517" : "#A32D2D";

  if (screen === "create") {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "2rem 1rem", fontFamily: "var(--font-serif, Georgia, serif)" }}>
        <h2 style={{ fontSize: 22, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 4 }}>A Chronicle of the Realm</h2>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 28, fontFamily: "var(--font-sans)" }}>Create your character before the adventure begins.</p>

        <label style={{ fontSize: 13, color: "var(--color-text-secondary)", fontFamily: "var(--font-sans)", display: "block", marginBottom: 6 }}>Your name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Enter your name..."
          style={{ width: "100%", marginBottom: 24, boxSizing: "border-box" }}
        />

        <label style={{ fontSize: 13, color: "var(--color-text-secondary)", fontFamily: "var(--font-sans)", display: "block", marginBottom: 12 }}>Choose your class</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28 }}>
          {CLASSES.map(cls => (
            <div
              key={cls.id}
              onClick={() => setSelectedClass(cls.id)}
              style={{
                padding: "14px 16px",
                borderRadius: "var(--border-radius-lg)",
                border: selectedClass === cls.id ? "2px solid var(--color-border-info)" : "0.5px solid var(--color-border-tertiary)",
                background: "var(--color-background-primary)",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 500, fontSize: 15, color: "var(--color-text-primary)", marginBottom: 2 }}>{cls.name}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8, fontFamily: "var(--font-sans)" }}>{cls.desc}</div>
              <div style={{ display: "flex", gap: 8, fontFamily: "var(--font-sans)" }}>
                {Object.entries(cls.stats).map(([k, v]) => (
                  <span key={k} style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{k.slice(0,3).toUpperCase()} {v}</span>
                ))}
                <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>HP {cls.hp}</span>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={startGame}
          disabled={!name.trim() || !selectedClass}
          style={{ width: "100%", padding: "12px", fontSize: 15, cursor: (!name.trim() || !selectedClass) ? "not-allowed" : "pointer", opacity: (!name.trim() || !selectedClass) ? 0.5 : 1 }}
        >
          Begin the journey
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "1.5rem 1rem", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "10px 14px", flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>{character?.name} · {character?.cls.name}</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>HP</div>
          <div style={{ height: 6, background: "var(--color-border-tertiary)", borderRadius: 3 }}>
            <div style={{ height: "100%", width: `${hpPct}%`, background: hpColor, borderRadius: 3, transition: "width 0.4s" }} />
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{hp} / {maxHp}</div>
        </div>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "10px 14px", minWidth: 80, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>Gold</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)" }}>{gold}</div>
        </div>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "10px 14px", minWidth: 80, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>XP</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)" }}>{xp}</div>
        </div>
        <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "10px 14px", flex: 2, minWidth: 160 }}>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 4 }}>Inventory</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{inventory.join(" · ")}</div>
        </div>
      </div>

      <div style={{ minHeight: 320, maxHeight: 420, overflowY: "auto", background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1.25rem", marginBottom: 14 }}>
        {log.map((entry, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            {entry.role === "dm" ? (
              <p style={{ fontSize: 15, lineHeight: 1.75, color: "var(--color-text-primary)", fontFamily: "var(--font-serif, Georgia, serif)", margin: 0 }}>{entry.text}</p>
            ) : (
              <p style={{ fontSize: 13, color: "var(--color-text-info)", fontStyle: "italic", margin: 0, paddingLeft: 12, borderLeft: "2px solid var(--color-border-info)" }}>{entry.text}</p>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--color-text-tertiary)", fontSize: 13 }}>
            <span style={{ animation: "pulse 1.2s infinite" }}>...</span>
          </div>
        )}
        <div ref={logEndRef} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {choices.map((c, i) => (
          <button
            key={i}
            onClick={() => handleChoice(c)}
            disabled={loading}
            style={{ textAlign: "left", padding: "11px 16px", fontSize: 14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, lineHeight: 1.5 }}
          >
            {c}
          </button>
        ))}
        {!loading && choices.length === 0 && log.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", textAlign: "center" }}>Your story is about to begin...</p>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
    </div>
  );
}
