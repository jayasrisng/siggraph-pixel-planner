import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

export type AvatarPreset = "kid" | "robot" | "cat" | "ghost" | "dino";
export type AvatarAccessory = "none" | "glasses" | "cap" | "headphones" | "badge";

export type AvatarConfig = {
  name: string;
  preset: AvatarPreset;
  hoodie: string;
  pants: string;
  hair: string;
  skin: string;
  hairStyle: "swoop" | "puffs" | "waves" | "short";
  accessory: AvatarAccessory;
};

export const defaultAvatar: AvatarConfig = {
  name: "Pixel",
  preset: "kid",
  hoodie: "#f49a1f",
  pants: "#26384e",
  hair: "#10232c",
  skin: "#c4916e",
  hairStyle: "swoop",
  accessory: "badge",
};

export const avatarPresets: Array<{ id: AvatarPreset; label: string; emojiHint: string }> = [
  { id: "kid", label: "Pixel Kid", emojiHint: "classic" },
  { id: "robot", label: "Render Bot", emojiHint: "beep" },
  { id: "cat", label: "Shader Cat", emojiHint: "meow" },
  { id: "ghost", label: "Ray Ghost", emojiHint: "boo" },
  { id: "dino", label: "Poly Dino", emojiHint: "rawr" },
];

export const accessories: Array<{ id: AvatarAccessory; label: string }> = [
  { id: "none", label: "None" },
  { id: "glasses", label: "Glasses" },
  { id: "cap", label: "Cap" },
  { id: "headphones", label: "Headphones" },
  { id: "badge", label: "Badge" },
];

export const palettes = {
  hoodie: ["#f49a1f", "#e87961", "#2b7291", "#9dbb8d", "#b287d8", "#f2b8c6", "#4ec9b0", "#39435c"],
  pants: ["#26384e", "#1e2528", "#3e5c76", "#6f614f", "#7c5f8f", "#9d4e5c"],
  hair: ["#10232c", "#2f211b", "#5c3b2d", "#c94f7c", "#4e7bc9", "#e8c14f", "#efefef"],
  skin: ["#f1c6a8", "#d9a078", "#b87956", "#7a4b38", "#c9d6e8", "#bde8c9"],
};

function Accessory({ avatar }: { avatar: AvatarConfig }) {
  switch (avatar.accessory) {
    case "glasses": {
      const y = avatar.preset === "kid" ? 88 : 99;
      return (
        <g className="acc">
          <circle cx={avatar.preset === "kid" ? 80 : 78} cy={y} r="14" fill="none" stroke="#1e2528" strokeWidth="4" />
          <circle cx="114" cy={y} r="14" fill="none" stroke="#1e2528" strokeWidth="4" />
          <line x1={avatar.preset === "kid" ? 94 : 92} y1={y} x2="100" y2={y} stroke="#1e2528" strokeWidth="4" />
        </g>
      );
    }
    case "cap":
      return (
        <g className="acc">
          <path d="M58 62 Q60 30 96 26 Q132 30 134 62 Q96 48 58 62 Z" fill={avatar.hoodie} stroke="#1e2528" strokeWidth="4" />
          <path d="M120 46 Q158 44 158 60 Q140 62 122 58 Z" fill={avatar.hoodie} stroke="#1e2528" strokeWidth="3.5" />
          <circle cx="96" cy="32" r="5" fill="#fff2dc" stroke="#1e2528" strokeWidth="2.5" />
        </g>
      );
    case "headphones":
      return (
        <g className="acc">
          <path d="M56 84 Q56 30 96 28 Q136 30 136 84" fill="none" stroke="#1e2528" strokeWidth="7" strokeLinecap="round" />
          <rect x="47" y="80" width="16" height="26" rx="7" fill="#39435c" stroke="#1e2528" strokeWidth="3" />
          <rect x="129" y="80" width="16" height="26" rx="7" fill="#39435c" stroke="#1e2528" strokeWidth="3" />
        </g>
      );
    case "badge":
      return (
        <g className="acc">
          <line x1="82" y1="146" x2="96" y2="176" stroke="#8a3341" strokeWidth="4" />
          <line x1="110" y1="146" x2="96" y2="176" stroke="#8a3341" strokeWidth="4" />
          <rect x="84" y="172" width="26" height="18" rx="3" fill="#fff6e7" stroke="#1e2528" strokeWidth="2.5" />
          <rect x="87" y="176" width="12" height="3.5" fill="#e87961" />
          <rect x="87" y="182" width="18" height="3" fill="#9db6bd" />
        </g>
      );
    default:
      return null;
  }
}

function Hair({ avatar }: { avatar: AvatarConfig }) {
  const hair = avatar.hairStyle ?? "swoop";
  if (avatar.accessory === "cap") return null;
  return (
    <>
      {hair === "swoop" && (
        <>
          <path d="M61 70 Q69 31 99 30 Q123 32 132 66 Q108 52 88 54 Q72 56 61 70 Z" fill={avatar.hair} />
          <path d="M73 42 Q88 18 111 32 Q106 62 78 60 Q70 55 73 42 Z" fill={avatar.hair} />
        </>
      )}
      {hair === "puffs" && (
        <>
          <circle cx="68" cy="58" r="20" fill={avatar.hair} />
          <circle cx="96" cy="44" r="24" fill={avatar.hair} />
          <circle cx="124" cy="58" r="20" fill={avatar.hair} />
        </>
      )}
      {hair === "waves" && (
        <path d="M60 76 Q65 36 90 30 Q110 24 132 64 Q124 54 112 66 Q100 50 88 66 Q76 52 64 72 Z" fill={avatar.hair} />
      )}
      {hair === "short" && <path d="M62 69 Q70 36 96 34 Q124 36 132 69 Q108 57 96 59 Q78 58 62 69 Z" fill={avatar.hair} />}
    </>
  );
}

function Eyes({ blink = true }: { blink?: boolean }) {
  return (
    <g className={blink ? "mascotEyes" : undefined}>
      <ellipse cx="78" cy="99" rx="8" ry="11" fill="#121719" />
      <ellipse cx="114" cy="99" rx="8" ry="11" fill="#121719" />
      <circle cx="81" cy="94" r="2.6" fill="#fff9ec" opacity="0.95" />
      <circle cx="117" cy="94" r="2.6" fill="#fff9ec" opacity="0.95" />
    </g>
  );
}

function KidBody({ avatar, pose = "idle" }: { avatar: AvatarConfig; pose?: "idle" | "wave" }) {
  const ink = "#1e2528";
  return (
    <>
      {/* straight, confident legs */}
      <path className="mascotLegBack" d="M82 178 H97 V240 H80 Z" fill={avatar.pants} stroke={ink} strokeWidth="3.5" strokeLinejoin="round" />
      <path className="mascotLegFront" d="M99 178 H114 V240 H97 Z" fill={avatar.pants} stroke={ink} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M76 238 H98 Q103 238 103 250 H72 Q72 241 76 238 Z" fill="#121719" />
      <path d="M96 238 H120 Q125 238 125 250 H94 Q94 241 96 238 Z" fill="#121719" />
      {/* arms: left relaxed; right relaxed or waving */}
      <path d="M70 128 Q58 146 60 172 Q66 180 76 174 Q74 152 80 136 Z" fill={avatar.hoodie} stroke={ink} strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="66" cy="176" r="9" fill={avatar.skin} stroke={ink} strokeWidth="3" />
      {pose === "idle" ? (
        <>
          <path d="M124 128 Q136 146 134 172 Q128 180 118 174 Q120 152 114 136 Z" fill={avatar.hoodie} stroke={ink} strokeWidth="3.5" strokeLinejoin="round" />
          <circle cx="128" cy="176" r="9" fill={avatar.skin} stroke={ink} strokeWidth="3" />
        </>
      ) : (
        <g className="waveArm">
          <path d="M120 132 Q140 118 148 96 Q142 86 132 90 Q122 108 112 122 Z" fill={avatar.hoodie} stroke={ink} strokeWidth="3.5" strokeLinejoin="round" />
          <circle cx="142" cy="88" r="10" fill={avatar.skin} stroke={ink} strokeWidth="3" />
        </g>
      )}
      {/* neat fitted hoodie torso */}
      <path d="M72 126 H122 Q130 132 129 172 Q113 184 97 184 Q81 184 65 172 Q64 132 72 126 Z" fill={avatar.hoodie} stroke={ink} strokeWidth="4" strokeLinejoin="round" />
      <path d="M84 128 Q97 140 110 128" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      <line x1="97" y1="140" x2="97" y2="182" stroke={ink} strokeWidth="2.5" opacity="0.25" />
      {/* head: rounded, upright */}
      <circle cx="97" cy="82" r="44" fill={avatar.skin} stroke={ink} strokeWidth="4" />
      <Hair avatar={avatar} />
      {/* soft brows + bright eyes + easy smile */}
      <path d="M72 72 Q80 66 88 71" fill="none" stroke={ink} strokeWidth="3.5" strokeLinecap="round" opacity="0.55" />
      <path d="M106 71 Q114 66 122 72" fill="none" stroke={ink} strokeWidth="3.5" strokeLinecap="round" opacity="0.55" />
      <g className="mascotEyes">
        <ellipse cx="80" cy="88" rx="7" ry="9.5" fill="#121719" />
        <ellipse cx="114" cy="88" rx="7" ry="9.5" fill="#121719" />
        <circle cx="82.5" cy="84" r="2.6" fill="#fff9ec" />
        <circle cx="116.5" cy="84" r="2.6" fill="#fff9ec" />
      </g>
      <circle cx="70" cy="102" r="5.5" fill="#e99b8c" opacity="0.5" />
      <circle cx="124" cy="102" r="5.5" fill="#e99b8c" opacity="0.5" />
      <path d="M84 106 Q97 118 110 106" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
    </>
  );
}

function RobotBody({ avatar }: { avatar: AvatarConfig }) {
  return (
    <>
      <rect x="76" y="176" width="16" height="64" rx="6" fill={avatar.pants} stroke="#172333" strokeWidth="3" className="mascotLegBack" />
      <rect x="102" y="176" width="16" height="64" rx="6" fill={avatar.pants} stroke="#172333" strokeWidth="3" className="mascotLegFront" />
      <rect x="70" y="238" width="26" height="12" rx="5" fill="#121719" />
      <rect x="100" y="238" width="26" height="12" rx="5" fill="#121719" />
      <rect x="58" y="134" width="76" height="54" rx="12" fill={avatar.hoodie} stroke="#1e2528" strokeWidth="4" />
      <circle cx="96" cy="160" r="10" fill="#fff6e7" stroke="#1e2528" strokeWidth="3" />
      <circle cx="96" cy="160" r="4" fill={avatar.pants} />
      <rect x="42" y="140" width="14" height="34" rx="6" fill={avatar.hoodie} stroke="#1e2528" strokeWidth="3" />
      <rect x="136" y="140" width="14" height="34" rx="6" fill={avatar.hoodie} stroke="#1e2528" strokeWidth="3" />
      <line x1="96" y1="52" x2="96" y2="38" stroke="#1e2528" strokeWidth="4" />
      <circle cx="96" cy="32" r="7" fill="#e87961" stroke="#1e2528" strokeWidth="3" className="antennaGlow" />
      <rect x="56" y="52" width="80" height="76" rx="18" fill={avatar.skin} stroke="#1e2528" strokeWidth="4" />
      <rect x="66" y="70" width="60" height="34" rx="10" fill="#121719" />
      <g className="mascotEyes">
        <rect x="74" y="80" width="12" height="14" rx="3" fill="#7ee8fa" />
        <rect x="106" y="80" width="12" height="14" rx="3" fill="#7ee8fa" />
      </g>
      <rect x="80" y="112" width="32" height="6" rx="3" fill="#1e2528" opacity="0.7" />
    </>
  );
}

function CatBody({ avatar }: { avatar: AvatarConfig }) {
  return (
    <>
      <path className="mascotLegBack" d="M78 176 H94 V240 H76 Z" fill={avatar.pants} stroke="#172333" strokeWidth="3" />
      <path className="mascotLegFront" d="M104 176 H120 V240 H102 Z" fill={avatar.pants} stroke="#172333" strokeWidth="3" />
      <ellipse cx="86" cy="244" rx="14" ry="7" fill={avatar.skin} stroke="#1e2528" strokeWidth="2.5" />
      <ellipse cx="112" cy="244" rx="14" ry="7" fill={avatar.skin} stroke="#1e2528" strokeWidth="2.5" />
      <path d="M132 190 Q166 184 160 152 Q176 178 152 200 Q140 202 132 190 Z" fill={avatar.skin} stroke="#1e2528" strokeWidth="3.5" className="catTail" />
      <path d="M64 138 H128 Q138 148 134 182 Q116 194 96 194 Q76 194 58 182 Q54 148 64 138 Z" fill={avatar.hoodie} stroke="#8c541d" strokeWidth="4" />
      <path d="M60 64 L74 30 L92 56 Z" fill={avatar.skin} stroke="#1e2528" strokeWidth="4" strokeLinejoin="round" />
      <path d="M132 64 L118 30 L100 56 Z" fill={avatar.skin} stroke="#1e2528" strokeWidth="4" strokeLinejoin="round" />
      <path d="M68 38 L76 36 L82 48 Z" fill="#f2b8c6" />
      <path d="M124 38 L116 36 L110 48 Z" fill="#f2b8c6" />
      <path d="M59 84 Q64 40 96 37 Q128 40 133 84 Q132 122 96 136 Q60 122 59 84 Z" fill={avatar.skin} stroke="#1e2528" strokeWidth="4" />
      <Eyes />
      <path d="M92 106 L100 106 L96 112 Z" fill="#f2b8c6" stroke="#1e2528" strokeWidth="2" strokeLinejoin="round" />
      <path d="M60 104 L38 100 M60 112 L40 116" stroke="#1e2528" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M132 104 L154 100 M132 112 L152 116" stroke="#1e2528" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M88 118 Q96 124 104 118" fill="none" stroke="#1e2528" strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

function GhostBody({ avatar }: { avatar: AvatarConfig }) {
  return (
    <g className="ghostFloat">
      <path
        d="M52 110 Q52 40 96 34 Q140 40 140 110 L140 220 Q129 206 118 220 Q107 234 96 220 Q85 206 74 220 Q63 234 52 220 Z"
        fill={avatar.hoodie}
        stroke="#1e2528"
        strokeWidth="4"
        opacity="0.94"
      />
      <path d="M62 96 Q66 56 96 52 Q126 56 130 96 Q128 122 96 130 Q64 122 62 96 Z" fill={avatar.skin} opacity="0.9" />
      <Eyes />
      <ellipse cx="96" cy="118" rx="7" ry="9" fill="#121719" opacity="0.85" />
      <circle cx="70" cy="112" r="6" fill="#e99b8c" opacity="0.4" />
      <circle cx="122" cy="112" r="6" fill="#e99b8c" opacity="0.4" />
    </g>
  );
}

function DinoBody({ avatar }: { avatar: AvatarConfig }) {
  return (
    <>
      <path className="mascotLegBack" d="M76 180 H94 V240 H74 Z" fill={avatar.hoodie} stroke="#1e2528" strokeWidth="3.5" />
      <path className="mascotLegFront" d="M104 180 H122 V240 H102 Z" fill={avatar.hoodie} stroke="#1e2528" strokeWidth="3.5" />
      <path d="M130 176 Q168 186 172 158 Q178 190 148 198 Q136 194 130 176 Z" fill={avatar.hoodie} stroke="#1e2528" strokeWidth="3.5" />
      <path d="M62 128 H130 Q140 142 136 184 Q116 196 96 196 Q76 196 58 184 Q54 142 62 128 Z" fill={avatar.hoodie} stroke="#1e2528" strokeWidth="4" />
      <ellipse cx="96" cy="162" rx="24" ry="20" fill={avatar.skin} opacity="0.85" />
      <path d="M96 30 L108 52 L84 52 Z M118 40 L126 60 L104 58 Z M74 40 L66 60 L88 58 Z" fill={avatar.pants} stroke="#1e2528" strokeWidth="3" strokeLinejoin="round" />
      <path d="M58 88 Q60 50 96 46 Q132 50 134 88 Q136 112 118 122 Q140 118 148 128 Q140 140 116 136 Q96 142 76 134 Q58 122 58 88 Z" fill={avatar.hoodie} stroke="#1e2528" strokeWidth="4" />
      <Eyes />
      <circle cx="128" cy="126" r="2.6" fill="#1e2528" />
      <path d="M84 118 Q92 124 102 120" fill="none" stroke="#1e2528" strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

export function PixelMascot({
  compact = false,
  avatar = defaultAvatar,
  className = "",
  pose = "idle",
}: {
  compact?: boolean;
  avatar?: AvatarConfig;
  className?: string;
  pose?: "idle" | "wave";
}) {
  const preset = avatar.preset ?? "kid";
  return (
    <svg
      className={`mascot ${compact ? "mascotSmall" : ""} ${className}`}
      viewBox="0 0 190 270"
      role="img"
      aria-label={`${avatar.name} pixel avatar`}
    >
      <ellipse cx="96" cy="254" rx="56" ry="10" fill="rgba(30,37,40,.16)" />
      <g className="mascotWalk">
        {preset === "kid" && <KidBody avatar={avatar} pose={pose} />}
        {preset === "robot" && <RobotBody avatar={avatar} />}
        {preset === "cat" && <CatBody avatar={avatar} />}
        {preset === "ghost" && <GhostBody avatar={avatar} />}
        {preset === "dino" && <DinoBody avatar={avatar} />}
        <Accessory avatar={avatar} />
      </g>
    </svg>
  );
}

/**
 * Rasterizes the exact SVG mascot (preset, accessories, colors) to a canvas.
 * Used by the recap GIF so the character is truly the user's own.
 */
export async function rasterizeMascot(
  avatar: AvatarConfig,
  pose: "idle" | "wave" = "idle",
  height = 270,
): Promise<HTMLCanvasElement> {
  const markup = renderToStaticMarkup(<PixelMascot avatar={avatar} pose={pose} />)
    .replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg" width="190" height="270"');
  const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("mascot rasterization failed"));
      image.src = url;
    });
    const width = Math.round((height * 190) / 270);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(image, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Renders the avatar head as a small canvas for the 3D map sprite. */
export function drawAvatarSpriteTexture(avatar: AvatarConfig, size = 128): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const s = size / 100;
  ctx.scale(s, s);
  // soft drop glow
  const glow = ctx.createRadialGradient(50, 54, 8, 50, 54, 46);
  glow.addColorStop(0, "rgba(255,255,255,0.9)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 100, 100);
  // body chip
  ctx.fillStyle = avatar.hoodie;
  ctx.strokeStyle = "#1e2528";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(30, 56, 40, 30, 10);
  ctx.fill();
  ctx.stroke();
  // head
  ctx.fillStyle = avatar.preset === "robot" ? avatar.skin : avatar.skin;
  ctx.beginPath();
  if (avatar.preset === "robot") ctx.roundRect(28, 18, 44, 40, 10);
  else ctx.arc(50, 38, 23, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (avatar.preset === "cat") {
    ctx.beginPath();
    ctx.moveTo(32, 24); ctx.lineTo(38, 8); ctx.lineTo(46, 20);
    ctx.moveTo(68, 24); ctx.lineTo(62, 8); ctx.lineTo(54, 20);
    ctx.fillStyle = avatar.skin;
    ctx.fill();
    ctx.stroke();
  }
  if (avatar.preset !== "robot" && avatar.accessory !== "cap") {
    ctx.fillStyle = avatar.hair;
    ctx.beginPath();
    ctx.ellipse(50, 22, 20, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (avatar.accessory === "cap") {
    ctx.fillStyle = avatar.hoodie;
    ctx.beginPath();
    ctx.ellipse(50, 20, 21, 9, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // eyes
  ctx.fillStyle = "#121719";
  ctx.beginPath();
  ctx.ellipse(42, 38, 4, 5.5, 0, 0, Math.PI * 2);
  ctx.ellipse(58, 38, 4, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(43.5, 36, 1.4, 0, Math.PI * 2);
  ctx.arc(59.5, 36, 1.4, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}
