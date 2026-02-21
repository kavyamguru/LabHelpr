import Image from "next/image";
import Link from "next/link";

const tools = [
  { href: "/calculator/unit-conversion", title: "Unit Conversion" },
  { href: "/calculator/dilution", title: "Dilution" },
  { href: "/calculator/molarity", title: "Molarity" },
  { href: "/calculator/centrifuge", title: "Centrifuge" },
  { href: "/calculator/pcr-mastermix", title: "PCR Mastermix" },
  { href: "/calculator/a260", title: "Nucleic Acid (A260)" },
  { href: "/calculator/serial-dilution", title: "Serial Dilution" },
  { href: "/calculator/stock-prep", title: "Stock Preparation" },
  { href: "/calculator/od600", title: "OD600" },
  { href: "/calculator/molecular-weight", title: "Molecular Weight" },
  { href: "/calculator/cell-seeding", title: "Mammalian Cell Seeding" },
];

const unitCategories: {
  title: string;
  note?: string;
  groups: { label?: string; items: string[] }[];
}[] = [
  {
    title: "Volume",
    note: "Most critical in wet labs",
    groups: [
      {
        label: "SI & Common",
        items: ["L (liter)", "mL (milliliter)", "µL (microliter)", "nL (nanoliter)", "pL (picoliter)"],
      },
      {
        label: "Less common / legacy",
        items: ["dL", "cL"],
      },
    ],
  },
  {
    title: "Mass / Weight",
    note: "Solids, biomolecules, pellets",
    groups: [
      { label: "SI", items: ["g", "mg", "µg", "ng", "pg", "fg"] },
      { label: "Molecular scale", items: ["Da (Dalton)", "kDa", "MDa"] },
    ],
  },
  {
    title: "Amount of Substance",
    note: "Used in molarity, buffers, enzymes",
    groups: [{ items: ["mol", "mmol", "µmol", "nmol", "pmol", "fmol"] }],
  },
  {
    title: "Concentration – Molar",
    note: "Core chemistry & molecular biology",
    groups: [{ items: ["M (mol/L)", "mM", "µM", "nM", "pM", "fM"] }],
  },
  {
    title: "Concentration – Mass/Volume",
    note: "Very common in biology",
    groups: [
      { items: ["g/L", "mg/mL", "µg/mL", "ng/mL", "pg/mL"] },
      { items: ["µg/µL", "ng/µL", "pg/µL"] },
    ],
  },
  {
    title: "Concentration – Percentage",
    note: "Buffers, reagents, disinfectants",
    groups: [{ items: ["% (w/v)", "% (v/v)", "% (w/w)"] }],
  },
  {
    title: "Concentration – Fold / Ratio",
    note: "Molecular biology standard",
    groups: [{ items: ["X (fold; e.g., 10X, 5X, 1X)", "Ratios (e.g., 1:10, 1:1000)"] }],
  },
  {
    title: "Optical Density / Absorbance",
    note: "Spectrophotometry",
    groups: [
      { items: ["OD", "OD600", "OD260", "OD280", "A230", "A260", "A280"] },
      { label: "Ratios", items: ["A260/A280", "A260/A230"] },
    ],
  },
  {
    title: "Length / Distance",
    note: "Plates, cuvettes, path length, cells",
    groups: [{ items: ["m", "cm", "mm", "µm", "nm"] }],
  },
  {
    title: "Area",
    note: "Cell culture & surface-based assays",
    groups: [{ items: ["cm²", "mm²", "m²"] }],
  },
  {
    title: "Cell Count & Density",
    note: "Cell culture, microbiology",
    groups: [
      { label: "Counts", items: ["cells", "CFU", "spores"] },
      { label: "Density", items: ["cells/mL", "cells/µL", "cells/cm²", "CFU/mL", "CFU/µL"] },
    ],
  },
  {
    title: "Centrifugation",
    note: "Every wet lab",
    groups: [
      { items: ["RPM", "RCF", "×g"] },
      { label: "Rotor radius", items: ["cm", "mm"] },
    ],
  },
  {
    title: "Time",
    note: "Incubation, centrifuge, PCR",
    groups: [{ items: ["s", "min", "h", "day(s)"] }],
  },
  {
    title: "Temperature",
    note: "Enzymes, incubations",
    groups: [{ items: ["°C", "K", "°F"] }],
  },
  {
    title: "Pressure",
    note: "Autoclaves, gas incubators",
    groups: [{ items: ["atm", "bar", "psi", "Pa", "kPa"] }],
  },
  {
    title: "pH & Chemical Properties",
    note: "Buffers & solutions",
    groups: [{ items: ["pH", "pKa"] }],
  },
  {
    title: "Enzyme Activity",
    note: "PCR, restriction digests",
    groups: [{ items: ["U", "U/µL", "U/mL", "U/reaction"] }],
  },
  {
    title: "DNA / RNA Specific Units",
    note: "Genomics & molecular biology",
    groups: [
      { label: "Quantity", items: ["bp", "kb", "Mb", "Gb"] },
      { label: "Mass", items: ["ng DNA", "pg DNA"] },
      { label: "Standards", items: ["dsDNA: 50 ng/µL", "RNA: 40 ng/µL", "ssDNA: 33 ng/µL"] },
    ],
  },
  {
    title: "Protein Units",
    note: "Proteomics, biochemistry",
    groups: [{ items: ["aa (amino acids)", "kDa", "µg protein", "mg protein", "mg/mL protein"] }],
  },
  {
    title: "PCR-Specific",
    note: "Thermocycler workflows",
    groups: [{ items: ["cycles", "µL/reaction", "pmol primer", "ng template", "U polymerase"] }],
  },
  {
    title: "Cell Culture Plates",
    note: "Seeding planner",
    groups: [
      { label: "Units", items: ["cells/well", "µL/well", "mL/well"] },
      { label: "Plate formats", items: ["6-well", "12-well", "24-well", "48-well", "96-well", "384-well"] },
    ],
  },
  {
    title: "Gas Concentrations (Incubators)",
    note: "Advanced labs",
    groups: [{ items: ["% CO₂", "% O₂"] }],
  },
  {
    title: "Miscellaneous / Advanced",
    note: "Less common but real",
    groups: [{ items: ["viscosity: cP", "conductivity: µS/cm", "conductivity: mS/cm", "osmolarity: mOsm/L", "osmolality: mOsm/kg"] }],
  },
];

export default function CalculatorPage() {
  return (
    <main className="calc-page">
      <header className="calc-card" style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 900 }}>
        <div className="brand-mark-wrap" aria-label="LabHelpr mark">
          <Image
            src="/labhelpr-logo.png"
            alt="LabHelpr logo mark"
            width={1024}
            height={1024}
            className="brand-mark"
          />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 24, lineHeight: 1.15 }}>LabHelpr</div>
          <div style={{ opacity: 0.8, fontSize: 14 }}>LH Calculator</div>
        </div>
      </header>

      <section className="calc-grid" style={{ marginTop: 16 }}>
        {tools.map((tool) => (
          <Link key={tool.href} href={tool.href} className="calc-card" style={{ textDecoration: "none" }}>
            <div style={{ fontWeight: 700 }}>{tool.title}</div>
          </Link>
        ))}
      </section>

      <section className="calc-card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Lab units reference</div>
        <p style={{ marginTop: 0, marginBottom: 12, fontSize: 14, opacity: 0.9 }}>
          Common units used across the calculators. Handy when preparing buffers, plating cells, or sanity-checking inputs.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          {unitCategories.map((cat) => (
            <div key={cat.title} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 700 }}>{cat.title}</div>
              {cat.note ? <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{cat.note}</div> : null}
              {cat.groups.map((group, idx) => (
                <div key={group.label ?? idx} style={{ marginTop: 8 }}>
                  {group.label ? <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>{group.label}</div> : null}
                  <ul style={{ margin: 4, marginLeft: 16, paddingLeft: 0, lineHeight: 1.5 }}>
                    {group.items.map((item) => (
                      <li key={item} style={{ fontSize: 13 }}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="calc-card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Feedback</div>
        <p style={{ marginTop: 0, marginBottom: 10, fontSize: 14, opacity: 0.9 }}>
          To improve the platform for you, please fill the feedback form.
        </p>
        <a href="https://forms.office.com/r/TMKSjrwFCh" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>
          Fill Feedback Form →
        </a>
      </section>
    </main>
  );
}
