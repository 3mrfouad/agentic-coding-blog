# Contributing

Thanks for helping. This project aims to be an accurate, plain-language map of how coding agents work.
It describes the loop in plain words rather than betting on any one term, because the names keep changing. Accuracy matters
more than size: one correct, well-sourced change beats ten guesses.

## Ways to contribute

- **Fix something wrong.** A box in the wrong place, a line that does not happen in practice, a summary that overstates.
- **Add a scenario.** A real task that shows a part of the loop the others do not.
- **Improve a popover.** A clearer summary, or an example that shows something the summary cannot.
- **Add a source.** A primary source that explains a part of the diagram well.
- **Fix a bug or improve the code.** Layout, accessibility, performance, mobile.

For anything large, such as a new box, a new group, or a change to how the loop is drawn, open an issue first so we can
agree on the shape before you build it.

## Getting set up

```bash
git clone https://github.com/OWNER/agenticcodingblog.git
cd agenticcodingblog
npm install
npm run dev
```

Before opening a pull request, run:

```bash
npm run check
npm run build
```

`npm run check` validates every data file and names the first problem it finds, such as a step pointing at a box that
does not exist.

## Changing the content

All content lives in `src/data/`. [`src/data/README.md`](src/data/README.md) describes every field. In short:

| File | Holds |
|---|---|
| `architecture.json` | Boxes, the parts inside them, the lines between them, and the groups. |
| `tasks.json` | The scenarios and their steps. |
| `resources.json` | The sources shown in the Library and linked from popovers. |
| `glossary.json` | The terms on the home page and in the Library, each linked to its box. |
| `site.json` | Site title and the repository address. |

### Adding a box or a line

- A box's **parts** are what it is made of. A **line** is something that really flows from one box to another.
  If you are unsure, it is probably a part.
- The model has one input, the context window, and one output, text and tool calls. Anything that should influence
  the model has to reach it through the context window. Lines should follow that rule.
- Put a new box in exactly one group, at the point in the group's order where it sits in the flow.

### Adding a scenario

- Base it on a real kind of task. Use concrete files, commands and numbers, and keep them plausible.
- Show at least one thing going wrong and how an instruction, check or limit catches it. That is the point of the diagram.
- Each step's `act` lists the boxes active in that step. Every id must exist; `npm run check` will tell you if not.

### Writing popover text

- **Summary:** one or two plain sentences. Say what the thing is and why it matters.
- **Example:** only if it shows something the summary does not. A bare value such as a branch name is not an example.
  Leave it out instead.
- Mark code with backticks, for example `` `tsc --noEmit` ``. It renders in monospace and never breaks mid-word.

### Adding a source

- Prefer **primary sources**: the team that built the tool or wrote the practice, or the official documentation.
  Avoid summaries of summaries, marketing pages and package listings.
- Open the link and read it before adding it. Make sure it says what the popover or glossary claims.
- Add it to `resources.json` with a one-line `about` that says why someone should read it, then reference it by `id`.

## Code

- Keep components small and readable; prefer clear names over comments, and comments over cleverness.
- Keep the page accessible: keyboard focus visible, text contrast readable in both themes, nothing conveyed by colour
  alone.
- Check your change in light and dark mode and on a narrow screen.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Make your change, then run `npm run check` and `npm run build`.
3. Open a pull request that says what you changed and why. For content changes, link the source you relied on.

Small, focused pull requests are reviewed fastest.

## Conduct

Be kind and assume good intent. Critique ideas, not people. Harassment of any kind is not welcome, and maintainers may
remove comments or contributors who do not follow this.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
