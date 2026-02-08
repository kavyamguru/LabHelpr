// lib/lab/molecularWeight.ts

export type MWResult =
  | { ok: true; mw_g_per_mol: number }
  | { ok: false; error: string };

// 1) Put your AW constant here
const AW: Record<string, number> = {
  H: 1.008, He: 4.0026,
  Li: 6.94, Be: 9.0122, B: 10.81, C: 12.011, N: 14.007, O: 15.999, F: 18.998, Ne: 20.18,
  Na: 22.99, Mg: 24.305, Al: 26.982, Si: 28.085, P: 30.974, S: 32.06, Cl: 35.45, Ar: 39.948,
  K: 39.098, Ca: 40.078, Sc: 44.956, Ti: 47.867, V: 50.942, Cr: 51.996, Mn: 54.938, Fe: 55.845,
  Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38, Ga: 69.723, Ge: 72.63, As: 74.922, Se: 78.971,
  Br: 79.904, Kr: 83.798,
  Rb: 85.468, Sr: 87.62, Y: 88.906, Zr: 91.224, Nb: 92.906, Mo: 95.95, Tc: 98, Ru: 101.07,
  Rh: 102.91, Pd: 106.42, Ag: 107.87, Cd: 112.41, In: 114.82, Sn: 118.71, Sb: 121.76, Te: 127.6,
  I: 126.9, Xe: 131.29,
  Cs: 132.91, Ba: 137.33, La: 138.91, Ce: 140.12, Pr: 140.91, Nd: 144.24, Pm: 145, Sm: 150.36,
  Eu: 151.96, Gd: 157.25, Tb: 158.93, Dy: 162.5, Ho: 164.93, Er: 167.26, Tm: 168.93, Yb: 173.05,
  Lu: 174.97,
  Hf: 178.49, Ta: 180.95, W: 183.84, Re: 186.21, Os: 190.23, Ir: 192.22, Pt: 195.08, Au: 196.97,
  Hg: 200.59, Tl: 204.38, Pb: 207.2, Bi: 208.98, Po: 209, At: 210, Rn: 222,
  Fr: 223, Ra: 226, Ac: 227, Th: 232.04, Pa: 231.04, U: 238.03, Np: 237, Pu: 244, Am: 243,
  Cm: 247, Bk: 247, Cf: 251, Es: 252, Fm: 257, Md: 258, No: 259, Lr: 266,
  Rf: 267, Db: 268, Sg: 269, Bh: 270, Hs: 270, Mt: 278, Ds: 281, Rg: 282, Cn: 285, Nh: 286,
  Fl: 289, Mc: 290, Lv: 293, Ts: 294, Og: 294,
};
// 2) Paste your helper functions here:
// isUpper, isLower, isDigit, parseNumber, computeSegmentMass

function isUpper(ch: string) { return ch >= "A" && ch <= "Z"; }
function isLower(ch: string) { return ch >= "a" && ch <= "z"; }
function isDigit(ch: string) { return ch >= "0" && ch <= "9"; }

function parseNumber(s: string, i: number) {
  let j = i;
  while (j < s.length && isDigit(s[j])) j++;
  const num = j > i ? Number(s.slice(i, j)) : 1;
  return { num, next: j };
}

function computeSegmentMass(segment: string): { mass: number; error?: string } {
  const s = segment.replace(/\s+/g, "");
  let i = 0;

  const CLOSER_FOR: Record<string, string> = {
    "(": ")",
    "[": "]",
    "{": "}",
  };

  function parseGroup(stopAt?: string): { mass: number; error?: string } {
    let mass = 0;

    while (i < s.length) {
      const ch = s[i];

      if (stopAt && ch === stopAt) break;

      if (ch === ")" || ch === "]" || ch === "}") {
        return { mass: 0, error: `Unmatched '${ch}'` };
      }

      if (ch === "(" || ch === "[" || ch === "{") {
        const open = ch;
        const close = CLOSER_FOR[open];

        i++;
        const inner = parseGroup(close);
        if (inner.error) return inner;

        if (i >= s.length || s[i] !== close) {
          return { mass: 0, error: `Missing closing '${close}'` };
        }

        i++;
        const { num, next } = parseNumber(s, i);
        i = next;
        mass += inner.mass * num;
        continue;
      }

      if (isUpper(ch)) {
        let sym = ch;
        i++;
        if (i < s.length && isLower(s[i])) { sym += s[i]; i++; }

        const aw = AW[sym];
        if (!aw) return { mass: 0, error: `Unknown element: ${sym}` };

        const { num, next } = parseNumber(s, i);
        i = next;
        mass += aw * num;
        continue;
      }

      if (ch === "·" || ch === ".") {
        return { mass: 0, error: "Use dots only between hydrate parts (e.g., MgSO4·7H2O)" };
      }

      return { mass: 0, error: `Unexpected character: '${ch}'` };
    }

    return { mass };
  }

  let leading = 1;
  if (i < s.length && isDigit(s[i])) {
    const out = parseNumber(s, i);
    leading = out.num;
    i = out.next;
  }

  const g = parseGroup();
  if (g.error) return g;

  if (i !== s.length) return { mass: 0, error: "Could not parse entire formula" };

  return { mass: g.mass * leading };
}

// 3) Export the one public function
export function molecularWeightFromFormula(formulaRaw: string): MWResult {
  const formula = formulaRaw.trim();
  if (!formula) return { ok: false, error: "Enter a chemical formula." };

  const parts = formula.split(/[·.]/).map((p) => p.trim()).filter(Boolean);
  let total = 0;

  for (const p of parts) {
    const seg = computeSegmentMass(p);
    if (seg.error) return { ok: false, error: seg.error };
    total += seg.mass;
  }

  return { ok: true, mw_g_per_mol: total };
}

