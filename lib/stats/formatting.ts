export type FormatOptions = {
  sigFigs: number;
  decimalPlaces?: number | null;
  scientificNotation: boolean;
  thousandsSeparator: boolean;
  padTrailingZeros: boolean;
};

export const defaultFormat: FormatOptions = {
  sigFigs: 3,
  decimalPlaces: null,
  scientificNotation: false,
  thousandsSeparator: false,
  padTrailingZeros: false,
};

export function formatNumber(value: number | null | undefined, opts: FormatOptions = defaultFormat): string {
  if (value === null || value === undefined || Number.isNaN(value) || !Number.isFinite(value)) return "—";
  const { sigFigs, decimalPlaces, scientificNotation, thousandsSeparator, padTrailingZeros } = opts;

  let str = "";
  const abs = Math.abs(value);

  if (scientificNotation || (abs !== 0 && (abs < 0.001 || abs >= 1e5))) {
    str = value.toExponential(sigFigs - 1);
  } else if (decimalPlaces !== null && decimalPlaces !== undefined) {
    str = value.toFixed(decimalPlaces);
  } else {
    str = value.toPrecision(sigFigs);
  }

  if (!scientificNotation && thousandsSeparator) {
    const [intPart, fracPart] = str.split(".");
    const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    str = fracPart !== undefined ? `${withSep}.${fracPart}` : withSep;
  }

  if (padTrailingZeros && decimalPlaces !== null && decimalPlaces !== undefined) {
    const parts = str.split(".");
    if (parts.length === 1 && decimalPlaces > 0) {
      str = `${str}.${"0".repeat(decimalPlaces)}`;
    } else if (parts.length === 2) {
      const needed = decimalPlaces - parts[1].length;
      if (needed > 0) str = `${parts[0]}.${parts[1]}${"0".repeat(needed)}`;
    }
  }

  return str;
}
