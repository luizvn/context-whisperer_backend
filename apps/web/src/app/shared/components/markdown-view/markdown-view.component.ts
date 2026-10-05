import { Component, computed, input } from "@angular/core";
import { marked } from "marked";
import { SafeHtmlPipe } from "@shared/pipes/safe-html.pipe";

@Component({
  selector: "app-markdown-view",
  standalone: true,
  imports: [SafeHtmlPipe],
  template: ` <div [class]="containerClasses()" [innerHTML]="parsedHtml() | safeHtml"></div> `,
})
export class MarkdownViewComponent {
  readonly content = input.required<string>();
  readonly className = input<string>("");

  readonly parsedHtml = computed(() => {
    const raw = this.content();
    if (!raw) return "";
    return marked.parse(raw, { async: false }) as string;
  });

  readonly containerClasses = computed(() => {
    const base =
      "prose prose-invert max-w-none text-sm leading-relaxed " +
      "prose-headings:text-foreground prose-headings:font-semibold " +
      "prose-p:text-foreground/90 prose-li:text-foreground/90 " +
      "prose-strong:text-foreground prose-code:text-primary " +
      "prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded " +
      "prose-pre:bg-muted prose-pre:border prose-pre:border-border";
    return this.className() ? `${base} ${this.className()}` : base;
  });
}
