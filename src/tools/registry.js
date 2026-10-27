
let TOOL_DEFINITIONS = [
  {
    name: "search_vault",
    description: "Search for files in the vault by filename or content. Returns matching file paths and snippets. For content searches, prefer narrowing with extensions and/or maxBytes to avoid slow scans.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (matched against filenames and optionally content)."
        },
        searchContent: {
          type: "boolean",
          description: "Whether to also search inside file contents (slower). Default: false. If true, use extensions/excludeExtensions/maxBytes to keep scans bounded.",
        },
        limit: {
          type: "number",
          description: "Maximum results to return. Default: 10."
        },
        extensions: {
          type: "string",
          description: "Optional extension filter for files to scan, e.g. '*.js;*.json' or '.js,.json'."
        },
        excludeExtensions: {
          type: "string",
          description: "Optional extension blacklist, e.g. '*.png;*.pdf;*.zip'."
        },
        allTextFiles: {
          type: "boolean",
          description: "When true, scan all text-like files (excluding built-in binary blacklist). Default: true."
        },
        maxBytes: {
          type: "number",
          description: "Maximum file size (in bytes) to read during content search. Default: 100000."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "snippets",
    description: "Search files and return snippet extracts only.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (path match by default; optional content search with searchContent=true)."
        },
        searchContent: {
          type: "boolean",
          description: "Whether to also search inside file contents. Default: false."
        },
        extensions: {
          type: "string",
          description: "Optional extension filter for files to scan, e.g. '*.md;*.js' or '.md,.js'."
        },
        excludeExtensions: {
          type: "string",
          description: "Optional extension blacklist, e.g. '*.png;*.pdf'."
        },
        allTextFiles: {
          type: "boolean",
          description: "When true, scan all text-like files (excluding built-in binary blacklist). Default: true."
        },
        maxBytes: {
          type: "integer",
          description: "Maximum file size (in bytes) to read during content search. Default: 100000."
        },
        match: {
          type: "string",
          enum: ["first", "best", "exact", "all"],
          description: "Selection mode: first=path-sorted first, best=deterministic ranking, exact=exact path match(es), all=select all up to maxMatches."
        },
        maxMatches: {
          type: "integer",
          description: "Maximum selected matches to read (default: 1; default 20 when match=all)."
        },
        maxBytesPerFile: {
          type: "integer",
          description: "Read cap per selected file. Returns truncation metadata when exceeded."
        },
        requireUnique: {
          type: "boolean",
          description: "When true, fail unless total match count is exactly 1 (checked before maxMatches)."
        },
        pathContains: {
          type: "string",
          description: "Optional additional path substring filter applied after matching and before selection."
        },
        maxMatchesScanned: {
          type: "integer",
          description: "Optional cap on stored matches while scanning (default: 500, max: 5000)."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "frontmatter",
    description: "Search files and return frontmatter extracts only.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (path match by default; optional content search with searchContent=true)."
        },
        searchContent: {
          type: "boolean",
          description: "Whether to also search inside file contents. Default: false."
        },
        extensions: {
          type: "string",
          description: "Optional extension filter for files to scan, e.g. '*.md;*.js' or '.md,.js'."
        },
        excludeExtensions: {
          type: "string",
          description: "Optional extension blacklist, e.g. '*.png;*.pdf'."
        },
        allTextFiles: {
          type: "boolean",
          description: "When true, scan all text-like files (excluding built-in binary blacklist). Default: true."
        },
        maxBytes: {
          type: "integer",
          description: "Maximum file size (in bytes) to read during content search. Default: 100000."
        },
        match: {
          type: "string",
          enum: ["first", "best", "exact", "all"],
          description: "Selection mode. first=path-sorted first, best=deterministic ranking, exact=exact path match(es), all=select all up to maxMatches."
        },
        maxMatches: {
          type: "integer",
          description: "Maximum selected matches to read (default: 1; default 20 when match=all)."
        },
        maxBytesPerFile: {
          type: "integer",
          description: "Read cap per selected file. Returns truncation metadata when exceeded."
        },
        requireUnique: {
          type: "boolean",
          description: "When true, fail unless total match count is exactly 1 (checked before maxMatches)."
        },
        pathContains: {
          type: "string",
          description: "Optional additional path substring filter applied after matching and before selection."
        },
        maxMatchesScanned: {
          type: "integer",
          description: "Optional cap on stored matches while scanning (default: 500, max: 5000)."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "search_read",
    description: "Search files, deterministically select match(es), and return full-file reads only (extract is always full). On query miss, returns no_match; if skipped due to command-chain stop (e.g., blocked_on_error), no search was executed.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (path match by default; optional content search with searchContent=true)."
        },
        searchContent: {
          type: "boolean",
          description: "Whether to also search inside file contents. Default: false."
        },
        extensions: {
          type: "string",
          description: "Optional extension filter for files to scan, e.g. '*.md;*.js' or '.md,.js'."
        },
        excludeExtensions: {
          type: "string",
          description: "Optional extension blacklist, e.g. '*.png;*.pdf'."
        },
        allTextFiles: {
          type: "boolean",
          description: "When true, scan all text-like files (excluding built-in binary blacklist). Default: true."
        },
        maxBytes: {
          type: "number",
          description: "Maximum file size (in bytes) to read during content search. Default: 100000."
        },
        match: {
          type: "string",
          enum: ["first", "best", "exact", "all"],
          description: "New selection mode. first=path-sorted first, best=deterministic ranking, exact=exact path match(es), all=select all up to maxMatches."
        },
        maxMatches: {
          type: "number",
          description: "Maximum selected matches to read (default: 1; default 20 when match=all)."
        },
        maxBytesPerFile: {
          type: "number",
          description: "Read cap per selected file. Returns truncation metadata when exceeded."
        },
        requireUnique: {
          type: "boolean",
          description: "When true, fail unless total match count is exactly 1 (checked before maxMatches)."
        },
        pathContains: {
          type: "string",
          description: "Optional additional path substring filter applied after matching and before selection."
        },
        maxMatchesScanned: {
          type: "number",
          description: "Optional cap on stored matches while scanning (default: 500, max: 5000)."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "read_file",
    description: "Read the full content of any file in the vault by its path.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file relative to vault root."
        }
      },
      required: ["path"]
    }
  },
  {
    name: "flush",
    description: "Flush previously stored read payloads from conversation history to reduce token footprint. Supports a specific file path or all read payloads.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Optional file path to flush. When omitted, all read payloads are flushed."
        },
        all: {
          type: "boolean",
          description: "When true, flush all stored read payloads regardless of path."
        }
      },
      required: []
    }
  },
  {
    name: "talk",
    description: "Print text to the user in the chat stream.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to print to the user."
        }
      },
      required: ["text"]
    }
  },
  {
    name: "talkAndEndTurn",
    description: "Print text to the user in the chat stream and end the assistant turn immediately.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to print to the user before ending the turn."
        },
        feedback: {
          type: "string",
          description: "Optional turn-level command feedback. Preferred over separate feedback tool calls. Omit when there are no issues."
        }
      },
      required: ["text"]
    }
  },
  {
    name: "edit_file",
    description: "Edit an existing text file. Supports one operation: 'find_replace' finds/replaces using one or more candidate strings.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file."
        },
        operation: {
          type: "string",
          enum: ["find_replace"],
          description: "The type of edit to perform."
        },
        content: {
          type: "string",
          description: "Replacement text for find_replace."
        },
        find: {
          description: "Text to find for find_replace. Can be a string or an array of candidate strings (first match wins)."
        },
        forgiveWhitespace: {
          type: "boolean",
          description: "For find_replace, also try a whitespace-forgiving match. All whitespace durations are equivalent, and \\n, \\r, \\t, space, and &nbsp; (any capitalization) are treated as whitespace. Default: true."
        },
        includeNearMatches: {
          type: "boolean",
          description: "For find_replace failures, include nearby snippet hints when possible. Default: false."
        },
      },
      required: ["path", "operation", "content"]
    }
  },
  {
    name: "overwrite",
    description: "Overwrite an existing text file with new content.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file."
        },
        content: {
          type: "string",
          description: "The full new content for the file."
        }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "insert",
    description: "Insert content into an existing text file at a specified position.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file."
        },
        position: {
          type: "string",
          enum: ["beginning", "end", "after_frontmatter"],
          description: "Where to insert content. 'after_frontmatter' inserts after the --- block."
        }
      },
      required: ["path", "position"]
    }
  },
  {
    name: "create_file",
    description: "Create a new file in the vault. Fails if the file already exists. IMPORTANT: The filename is the title in Obsidian, so never start content with an H1 heading that repeats the filename.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path for the new file relative to vault root (e.g. 'Notes/meeting.md')."
        },
        content: {
          type: "string",
          description: "Content of the new file."
        }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "list_files",
    description: "List files in the vault, optionally filtered by folder and/or extension.",
    inputSchema: {
      type: "object",
      properties: {
        folder: {
          type: "string",
          description: "Folder path to list (e.g. 'Projects'). Omit to list all files."
        },
        extension: {
          type: "string",
          description: "Filter by file extension (e.g. 'md'). Omit to include all types."
        }
      },
      required: []
    }
  },
  {
    name: "biggest",
    description: "Find the biggest files by included extensions, scanning from vault root through all subdirectories, and return the top 20 by size.",
    inputSchema: {
      type: "object",
      properties: {
        extensions: {
          type: "string",
          description: "Extensions to include, e.g. '.js,.md' or '*.js;*.md'."
        }
      },
      required: ["extensions"]
    }
  },
  {
    name: "rename_file",
    description: "Rename or move a file in the vault. Can be used to rename a note or move it to a different folder.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Current path of the file relative to vault root."
        },
        new_path: {
          type: "string",
          description: "New path for the file relative to vault root."
        }
      },
      required: ["path", "new_path"]
    }
  },
  {
    name: "delete_file",
    description: "Move a file to the Obsidian trash. Use with caution.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path of the file to delete relative to vault root."
        }
      },
      required: ["path"]
    }
  },
  {
    name: "get_properties",
    description: "Read the YAML frontmatter properties of a markdown document as structured data. Returns tags, aliases, and all custom properties.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the document. Omit to use the active document."
        }
      },
      required: []
    }
  },
  {
    name: "set_properties",
    description: "Set or update YAML frontmatter properties on a markdown document. Merges with existing properties. Set a value to null to remove a property.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the document. Omit to use the active document."
        },
        properties: {
          type: "object",
          description: "Key-value pairs to set in the frontmatter. Arrays (like tags) are supported. Set a value to null to remove that property."
        }
      },
      required: ["properties"]
    }
  },
  {
    name: "get_backlinks",
    description: "Find all notes in the vault that link to a given document. Uses Obsidian's metadata cache for fast lookups.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the document. Omit to use the active document."
        }
      },
      required: []
    }
  },
  {
    name: "get_current_datetime",
    description: "Get the current date and time in the user's local timezone. Useful for daily notes, journaling, scheduling, or any time-aware task.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "open_document",
    description: "Open a document in the Obsidian editor. Use this when the user wants to navigate to, view, or open a specific file.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file relative to vault root."
        }
      },
      required: ["path"]
    }
  },

  {
    name: "agents",
    description: "Manage and read a project AGENTS.md file used as persistent instructions. Supports inline include directives in AGENTS content, such as {#include path/to/file.md} or {#include path/to/file.md#Heading}. Provide a path to set it, '-' to clear it, or omit path to read current configured AGENTS content.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Vault-relative or absolute path to AGENTS.md. Use '-' to clear configured agents file. Omit to read current agents content. Include directives are resolved when AGENTS context is loaded."
        }
      },
      required: []
    }
  },
  {
    name: "revert_edit",
    description: "Revert assistant-made edits using the local edit journal. Provide path to revert the latest change for a file, or entryId to revert a specific journal entry.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to a file. Reverts the latest journaled change for this file."
        },
        entryId: {
          type: "string",
          description: "Specific journal entry id to revert."
        }
      },
      required: []
    }
  }
];



declareExports({
  TOOL_DEFINITIONS
});
