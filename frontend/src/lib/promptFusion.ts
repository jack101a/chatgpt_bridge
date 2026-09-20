import { PromptVariable } from '../types';

/**
 * Extracts a subject concept and a slash command query from user input.
 * Examples:
 *   "/diorama" -> { userConcept: "", slashQuery: "diorama", hasSlash: true }
 *   "cyberpunk samurai /" -> { userConcept: "cyberpunk samurai", slashQuery: "", hasSlash: true }
 *   "cyberpunk samurai /dio" -> { userConcept: "cyberpunk samurai", slashQuery: "dio", hasSlash: true }
 *   "a cute red panda" -> { userConcept: "a cute red panda", slashQuery: "", hasSlash: false }
 */
export function parseSlashInput(text: string): {
  userConcept: string;
  slashQuery: string;
  hasSlash: boolean;
  slashIndex: number;
} {
  const slashIdx = text.lastIndexOf('/');
  if (slashIdx === -1) {
    return { userConcept: text.trim(), slashQuery: '', hasSlash: false, slashIndex: -1 };
  }

  // Ensure slash is preceded by space, start of line, or punctuation (not inside a URL like http://)
  if (slashIdx > 0 && !/\s/.test(text[slashIdx - 1])) {
    return { userConcept: text.trim(), slashQuery: '', hasSlash: false, slashIndex: -1 };
  }

  const userConcept = text.slice(0, slashIdx).trim();
  const slashQuery = text.slice(slashIdx + 1).toLowerCase().trim();

  return {
    userConcept,
    slashQuery,
    hasSlash: true,
    slashIndex: slashIdx,
  };
}

/**
 * Smartly fuses a user's core idea/concept with a curated photography or art template.
 * If user has not typed an idea, falls back to the curated prompt's default subject.
 */
export function fusePrompt(
  templatePrompt: string,
  userConcept?: string,
  variables?: PromptVariable[]
): string {
  const concept = userConcept?.trim();

  // 1. If no user concept provided, resolve any remaining {subject} to default
  if (!concept) {
    return templatePrompt
      .replace(/\{subject\}/gi, 'hero subject')
      .replace(/\{[a-z0-9_-]+\}/gi, '')
      .trim();
  }

  let fused = templatePrompt;

  // 2. Direct placeholder substitution if template has {subject} or similar
  if (/\{subject\}/i.test(fused)) {
    return fused.replace(/\{subject\}/gi, concept);
  }

  // 3. Bracket placeholder substitution e.g. [Subject], [Object], [Hero]
  if (/\[(?:subject|object|product|hero|item|character|fruit|food)\]/i.test(fused)) {
    return fused.replace(/\[(?:subject|object|product|hero|item|character|fruit|food)\]/gi, concept);
  }

  // 4. If variables are provided, look for a subject variable default
  if (variables && variables.length > 0) {
    const subjectVar = variables.find((v) =>
      ['subject', 'product', 'fruit', 'food', 'character', 'hero'].includes(v.key.toLowerCase())
    );
    if (subjectVar && subjectVar.default && fused.includes(subjectVar.default)) {
      return fused.replace(subjectVar.default, concept);
    }
  }

  // 5. Natural Language Subject Insertion
  // Looks for common art/photography prompt patterns:
  // "photograph of [X],", "diorama featuring [X],", "render of [X] resting on"
  const anchorRegex = /((?:photograph|photo|portrait|still|illustration|render|diorama|sculpture|painting|depicting|featuring)\s+(?:of|featuring|depicting)?\s+)([^,.]+?)(,\s*|\.\s*|\s+with\s+|\s+on\s+|\s+in\s+)/i;
  
  if (anchorRegex.test(fused)) {
    return fused.replace(anchorRegex, (_match, prefix, _oldSubject, suffix) => {
      return `${prefix}${concept}${suffix}`;
    });
  }

  // 6. Safe fallback: Prepend concept smoothly to preserved aesthetic instructions
  return `${concept}. ${fused}`.trim();
}

/**
 * Extracts key variable tags from a prompt text for interactive chip editing.
 */
export function extractEditableTokens(prompt: string): Array<{ key: string; label: string; value: string }> {
  const tokens: Array<{ key: string; label: string; value: string }> = [];

  // Detect camera / lens specs
  const lensMatch = prompt.match(/\b(\d{2,3}mm(?:\s+f\/[\d.]+)?|\bmacro lens\b|\banamorphic\b|\bwide angle\b|\btilt-shift\b)/i);
  if (lensMatch) {
    tokens.push({ key: 'lens', label: 'Lens', value: lensMatch[1] });
  }

  // Detect lighting
  const lightMatch = prompt.match(/\b(golden hour|cinematic lighting|studio lighting|rim light(?:ing)?|neon lighting|volumetric lighting|soft diffused light|chiaroscuro)\b/i);
  if (lightMatch) {
    tokens.push({ key: 'lighting', label: 'Lighting', value: lightMatch[1] });
  }

  // Detect aspect / medium
  const mediumMatch = prompt.match(/\b(35mm film|Kodak Vision3|Blender Cycles|Studio Ghibli|claymation|origami|isometric 3D|high-contrast fashion|vector art)\b/i);
  if (mediumMatch) {
    tokens.push({ key: 'style', label: 'Style', value: mediumMatch[1] });
  }

  return tokens;
}
