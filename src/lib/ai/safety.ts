const UNSAFE_EXECUTABLE_SYNTAX = [
  /```/,
  /<\s*\/?\s*(?:script|style)\b/i,
  /^\s*(?:curl|wget)\s+(?:-\S+\s+)*https?:\/\//im,
  /^\s*(?:npm|pnpm|yarn)\s+(?:add|install|run|exec|dlx|create)\b/im,
  /^\s*(?:node|python(?:3)?)\s+(?:-\S+\s+)*\S+\.(?:[cm]?js|ts|py)\b/im,
  /^\s*(?:bash|sh)\s+(?:-\S+\s+)*\S+\.(?:ba)?sh\b/im,
  /^\s*(?:powershell|pwsh)\s+(?:-\S+\s+)*(?:\S+\.ps1|-Command\b)/im,
  /^\s*cmd\s+\/[CK]\b/im,
  /^\s*import\s+(?:(?:type\s+)?(?:[A-Za-z_$][\w$]*|\*\s+as\s+[A-Za-z_$][\w$]*)(?:\s*,\s*{[^}]*})?\s+from\s+|{[^}]*}\s+from\s+|["'][^"']+["'])/im,
  /^\s*export\s+(?:default\s+|(?:const|let|var|function|class|interface|type)\b|{|\*)/im,
  /^\s*(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=/im,
  /^\s*(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/im,
  /^\s*class\s+[A-Za-z_$][\w$]*(?:\s+extends\s+[A-Za-z_$][\w$]*)?\s*\{/im,
  /^\s*interface\s+[A-Za-z_$][\w$]*(?:\s+extends\s+[\w$\s,]+)?\s*\{/im,
  /^\s*type\s+[A-Za-z_$][\w$]*\s*=/im,
];

export class UnsafeSocialCopyError extends Error {
  constructor() {
    super("AI output contains unsafe executable syntax.");
    this.name = "UnsafeSocialCopyError";
  }
}

export function assertSafeSocialCopy(text: string): void {
  if (UNSAFE_EXECUTABLE_SYNTAX.some((pattern) => pattern.test(text))) {
    throw new UnsafeSocialCopyError();
  }
}
