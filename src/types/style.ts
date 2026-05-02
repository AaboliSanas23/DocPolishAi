export type BulletStyle =
  | "dot"
  | "dash";

export interface StyleConfig {
  titleSize: number;
  subtitleSize: number;
  paragraphSize: number;
  titleLineHeight: number;
  subtitleLineHeight: number;
  paragraphLineHeight: number;
  paragraphSpacing: number;
  fontFamily: string;
  bulletStyle: BulletStyle;
}

export const DEFAULT_STYLE_CONFIG: StyleConfig = {
  titleSize: 24,
  subtitleSize: 18,
  paragraphSize: 14,
  titleLineHeight: 1.4,
  subtitleLineHeight: 1.4,
  paragraphLineHeight: 1.8,
  paragraphSpacing: 10,
  fontFamily: "Calibri",
  bulletStyle: "dot",
};