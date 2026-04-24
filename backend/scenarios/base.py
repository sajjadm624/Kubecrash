ANSI = {
    "reset": "\033[0m",
    "red": "\033[31m",
    "green": "\033[32m",
    "yellow": "\033[33m",
    "blue": "\033[34m",
    "cyan": "\033[36m",
    "bold": "\033[1m",
    "dim": "\033[2m",
}


def c(color: str, text: str) -> str:
    return f"{ANSI.get(color, '')}{text}{ANSI['reset']}"


def table(headers: list, rows: list, col_widths: list = None) -> str:
    """Render a simple fixed-width table like kubectl output."""
    if not col_widths:
        col_widths = [max(len(str(row[i])) for row in ([headers] + rows)) + 2
                      for i in range(len(headers))]
    header_line = "".join(str(h).ljust(col_widths[i]) for i, h in enumerate(headers))
    row_lines = ["".join(str(r).ljust(col_widths[i]) for i, r in enumerate(row)) for row in rows]
    return "\n".join([header_line] + row_lines)


def not_found(resource: str, name: str, namespace: str) -> str:
    return c("red", f'Error from server (NotFound): {resource} "{name}" not found in namespace "{namespace}"')


def unknown_command(cmd: str) -> str:
    return c("red", f"error: unknown command: {cmd}\nRun 'kubectl --help' for usage.")
