// Text input tuned for Romanian typing (PRD NFR-3).

export function answerInput({ size, placeholder = "", onSubmit } = {}) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "answer-input";
  input.lang = "ro";
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocorrect", "off");
  input.spellcheck = false;
  input.enterKeyHint = "done";
  if (placeholder) input.placeholder = placeholder;
  if (size) input.size = Math.max(size, 3);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && onSubmit) {
      e.preventDefault();
      onSubmit(input.value);
    }
  });
  return input;
}
