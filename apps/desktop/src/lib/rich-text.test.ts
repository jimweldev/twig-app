import { describe, expect, it } from "vitest";
import { hasText, textToHtml, toHtml, toText } from "./rich-text";

describe("textToHtml", () => {
  it("turns numbered and dashed lines into lists, and escapes the rest", () => {
    expect(textToHtml("Intro <b>\n1. One\n2. Two\n- A\nEnd")).toBe(
      "<p>Intro &lt;b&gt;</p><ol><li><p>One</p></li><li><p>Two</p></li></ol><ul><li><p>A</p></li></ul><p>End</p>",
    );
  });
});

describe("equations", () => {
  it("turns $LaTeX$ into an equation and back, but leaves money alone", () => {
    const html = textToHtml("Solve $x^2 = 4$ for $5 and $10.");
    expect(html).toBe('<p>Solve <span data-type="inline-math" data-latex="x^2 = 4"></span> for $5 and $10.</p>');
    expect(toText(html)).toBe("Solve $x^2 = 4$ for $5 and $10.");
  });
});

describe("toHtml", () => {
  it("leaves editor HTML as it is", () => {
    expect(toHtml("<p><strong>Hi</strong></p>")).toBe("<p><strong>Hi</strong></p>");
    expect(toHtml(undefined)).toBe("");
  });
});

describe("toText", () => {
  it("turns editor HTML back into lines, numbering ordered lists", () => {
    expect(toText("<p>Do &amp; see</p><ol><li><p>One</p></li><li><p>Two</p></li></ol><ul><li><p>A</p></li></ul>")).toBe(
      "Do & see\n1. One\n2. Two\n- A",
    );
  });

  it("keeps plain text as it is", () => {
    expect(toText("Line 1\nLine 2")).toBe("Line 1\nLine 2");
  });
});

describe("hasText", () => {
  it("treats an emptied editor as blank", () => {
    expect(hasText("<p></p>")).toBe(false);
    expect(hasText("  ")).toBe(false);
    expect(hasText("<p>x</p>")).toBe(true);
  });
});
