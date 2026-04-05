#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Octokit } from "@octokit/rest";
import { z } from "zod";

const token = process.env.GITHUB_TOKEN;
const octokit = new Octokit({ auth: token });

const server = new Server(
  { name: "github-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "search_repositories",
    description: "Search GitHub repositories by query string",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (e.g. 'react stars:>1000')" },
        per_page: { type: "number", description: "Results per page (max 100, default 10)" },
        page: { type: "number", description: "Page number (default 1)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_repository",
    description: "Get details about a GitHub repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner (user or org)" },
        repo: { type: "string", description: "Repository name" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "list_issues",
    description: "List issues in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        state: { type: "string", enum: ["open", "closed", "all"], description: "Default: open" },
        labels: { type: "string", description: "Comma-separated label names" },
        per_page: { type: "number", description: "Results per page (max 100, default 10)" },
        page: { type: "number" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "get_issue",
    description: "Get a specific issue by number",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        issue_number: { type: "number", description: "Issue number" },
      },
      required: ["owner", "repo", "issue_number"],
    },
  },
  {
    name: "create_issue",
    description: "Create a new issue in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        title: { type: "string", description: "Issue title" },
        body: { type: "string", description: "Issue body (markdown)" },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Labels to apply",
        },
        assignees: {
          type: "array",
          items: { type: "string" },
          description: "Usernames to assign",
        },
      },
      required: ["owner", "repo", "title"],
    },
  },
  {
    name: "create_issue_comment",
    description: "Add a comment to an issue or pull request",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        issue_number: { type: "number" },
        body: { type: "string", description: "Comment body (markdown)" },
      },
      required: ["owner", "repo", "issue_number", "body"],
    },
  },
  {
    name: "list_pull_requests",
    description: "List pull requests in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        state: { type: "string", enum: ["open", "closed", "all"], description: "Default: open" },
        base: { type: "string", description: "Filter by base branch name" },
        head: { type: "string", description: "Filter by head branch (user:branch)" },
        per_page: { type: "number", description: "Results per page (max 100, default 10)" },
        page: { type: "number" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "get_pull_request",
    description: "Get a specific pull request by number",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        pull_number: { type: "number", description: "Pull request number" },
      },
      required: ["owner", "repo", "pull_number"],
    },
  },
  {
    name: "list_pr_files",
    description: "List files changed in a pull request",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        pull_number: { type: "number" },
        per_page: { type: "number", description: "Results per page (max 100, default 30)" },
        page: { type: "number" },
      },
      required: ["owner", "repo", "pull_number"],
    },
  },
  {
    name: "get_file_contents",
    description: "Get the contents of a file from a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        path: { type: "string", description: "File path within the repository" },
        ref: { type: "string", description: "Branch, tag, or commit SHA (default: default branch)" },
      },
      required: ["owner", "repo", "path"],
    },
  },
  {
    name: "list_commits",
    description: "List commits in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        sha: { type: "string", description: "Branch or commit SHA to start listing from" },
        path: { type: "string", description: "Only commits containing this file path" },
        per_page: { type: "number", description: "Results per page (max 100, default 10)" },
        page: { type: "number" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "search_code",
    description: "Search for code across GitHub repositories",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (e.g. 'addClass repo:jquery/jquery')",
        },
        per_page: { type: "number", description: "Results per page (max 100, default 10)" },
        page: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "list_workflow_runs",
    description: "List GitHub Actions workflow runs for a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        workflow_id: {
          type: "string",
          description: "Workflow file name or ID (optional — lists all runs if omitted)",
        },
        status: {
          type: "string",
          enum: ["completed", "action_required", "cancelled", "failure", "neutral", "skipped", "stale", "success", "timed_out", "in_progress", "queued", "requested", "waiting"],
          description: "Filter by run status",
        },
        per_page: { type: "number", description: "Results per page (max 100, default 10)" },
        page: { type: "number" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "get_authenticated_user",
    description: "Get the currently authenticated GitHub user",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "list_user_repos",
    description: "List repositories for a user or the authenticated user",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "GitHub username (omit for authenticated user)" },
        type: { type: "string", enum: ["all", "owner", "member"], description: "Default: owner" },
        sort: { type: "string", enum: ["created", "updated", "pushed", "full_name"], description: "Default: updated" },
        per_page: { type: "number", description: "Results per page (max 100, default 10)" },
        page: { type: "number" },
      },
      required: [],
    },
  },
];

// ── Tool handlers ───────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "search_repositories": {
        const { query, per_page = 10, page = 1 } = args as {
          query: string; per_page?: number; page?: number;
        };
        const { data } = await octokit.rest.search.repos({ q: query, per_page, page });
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              total_count: data.total_count,
              repositories: data.items.map((r) => ({
                full_name: r.full_name,
                description: r.description,
                stars: r.stargazers_count,
                forks: r.forks_count,
                language: r.language,
                url: r.html_url,
                updated_at: r.updated_at,
              })),
            }, null, 2),
          }],
        };
      }

      case "get_repository": {
        const { owner, repo } = args as { owner: string; repo: string };
        const { data } = await octokit.rest.repos.get({ owner, repo });
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              full_name: data.full_name,
              description: data.description,
              default_branch: data.default_branch,
              stars: data.stargazers_count,
              forks: data.forks_count,
              open_issues: data.open_issues_count,
              language: data.language,
              visibility: data.visibility,
              url: data.html_url,
              clone_url: data.clone_url,
              created_at: data.created_at,
              updated_at: data.updated_at,
              pushed_at: data.pushed_at,
              topics: data.topics,
              license: data.license?.name ?? null,
            }, null, 2),
          }],
        };
      }

      case "list_issues": {
        const { owner, repo, state = "open", labels, per_page = 10, page = 1 } = args as {
          owner: string; repo: string; state?: "open" | "closed" | "all";
          labels?: string; per_page?: number; page?: number;
        };
        const { data } = await octokit.rest.issues.listForRepo({
          owner, repo, state, labels, per_page, page,
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(data.filter((i) => !i.pull_request).map((i) => ({
              number: i.number,
              title: i.title,
              state: i.state,
              labels: i.labels.map((l) => (typeof l === "string" ? l : l.name)),
              assignees: i.assignees?.map((a) => a.login),
              created_at: i.created_at,
              updated_at: i.updated_at,
              url: i.html_url,
            })), null, 2),
          }],
        };
      }

      case "get_issue": {
        const { owner, repo, issue_number } = args as {
          owner: string; repo: string; issue_number: number;
        };
        const { data } = await octokit.rest.issues.get({ owner, repo, issue_number });
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              number: data.number,
              title: data.title,
              state: data.state,
              body: data.body,
              author: data.user?.login,
              labels: data.labels.map((l) => (typeof l === "string" ? l : l.name)),
              assignees: data.assignees?.map((a) => a.login),
              created_at: data.created_at,
              updated_at: data.updated_at,
              closed_at: data.closed_at,
              url: data.html_url,
              comments: data.comments,
            }, null, 2),
          }],
        };
      }

      case "create_issue": {
        const { owner, repo, title, body, labels, assignees } = args as {
          owner: string; repo: string; title: string; body?: string;
          labels?: string[]; assignees?: string[];
        };
        const { data } = await octokit.rest.issues.create({
          owner, repo, title, body, labels, assignees,
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ number: data.number, url: data.html_url, title: data.title }, null, 2),
          }],
        };
      }

      case "create_issue_comment": {
        const { owner, repo, issue_number, body } = args as {
          owner: string; repo: string; issue_number: number; body: string;
        };
        const { data } = await octokit.rest.issues.createComment({ owner, repo, issue_number, body });
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ id: data.id, url: data.html_url }, null, 2),
          }],
        };
      }

      case "list_pull_requests": {
        const { owner, repo, state = "open", base, head, per_page = 10, page = 1 } = args as {
          owner: string; repo: string; state?: "open" | "closed" | "all";
          base?: string; head?: string; per_page?: number; page?: number;
        };
        const { data } = await octokit.rest.pulls.list({
          owner, repo, state, base, head, per_page, page,
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(data.map((pr) => ({
              number: pr.number,
              title: pr.title,
              state: pr.state,
              draft: pr.draft,
              author: pr.user?.login,
              base: pr.base.ref,
              head: pr.head.ref,
              labels: pr.labels.map((l) => l.name),
              created_at: pr.created_at,
              updated_at: pr.updated_at,
              url: pr.html_url,
            })), null, 2),
          }],
        };
      }

      case "get_pull_request": {
        const { owner, repo, pull_number } = args as {
          owner: string; repo: string; pull_number: number;
        };
        const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number });
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              number: data.number,
              title: data.title,
              state: data.state,
              draft: data.draft,
              body: data.body,
              author: data.user?.login,
              base: data.base.ref,
              head: data.head.ref,
              labels: data.labels.map((l) => l.name),
              assignees: data.assignees?.map((a) => a.login),
              reviewers: data.requested_reviewers?.map((r) => r.login),
              mergeable: data.mergeable,
              mergeable_state: data.mergeable_state,
              commits: data.commits,
              additions: data.additions,
              deletions: data.deletions,
              changed_files: data.changed_files,
              created_at: data.created_at,
              updated_at: data.updated_at,
              merged_at: data.merged_at,
              url: data.html_url,
            }, null, 2),
          }],
        };
      }

      case "list_pr_files": {
        const { owner, repo, pull_number, per_page = 30, page = 1 } = args as {
          owner: string; repo: string; pull_number: number; per_page?: number; page?: number;
        };
        const { data } = await octokit.rest.pulls.listFiles({
          owner, repo, pull_number, per_page, page,
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(data.map((f) => ({
              filename: f.filename,
              status: f.status,
              additions: f.additions,
              deletions: f.deletions,
              changes: f.changes,
              patch: f.patch,
            })), null, 2),
          }],
        };
      }

      case "get_file_contents": {
        const { owner, repo, path, ref } = args as {
          owner: string; repo: string; path: string; ref?: string;
        };
        const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref });
        if (Array.isArray(data)) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify(data.map((item) => ({
                name: item.name,
                type: item.type,
                size: item.size,
                path: item.path,
              })), null, 2),
            }],
          };
        }
        if (data.type === "file" && "content" in data) {
          const content = Buffer.from(data.content, "base64").toString("utf-8");
          return {
            content: [{
              type: "text",
              text: content,
            }],
          };
        }
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "list_commits": {
        const { owner, repo, sha, path, per_page = 10, page = 1 } = args as {
          owner: string; repo: string; sha?: string; path?: string;
          per_page?: number; page?: number;
        };
        const { data } = await octokit.rest.repos.listCommits({
          owner, repo, sha, path, per_page, page,
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(data.map((c) => ({
              sha: c.sha,
              message: c.commit.message,
              author: c.commit.author?.name,
              date: c.commit.author?.date,
              url: c.html_url,
            })), null, 2),
          }],
        };
      }

      case "search_code": {
        const { query, per_page = 10, page = 1 } = args as {
          query: string; per_page?: number; page?: number;
        };
        const { data } = await octokit.rest.search.code({ q: query, per_page, page });
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              total_count: data.total_count,
              items: data.items.map((item) => ({
                name: item.name,
                path: item.path,
                repository: item.repository.full_name,
                url: item.html_url,
              })),
            }, null, 2),
          }],
        };
      }

      case "list_workflow_runs": {
        const { owner, repo, workflow_id, status, per_page = 10, page = 1 } = args as {
          owner: string; repo: string; workflow_id?: string;
          status?: string; per_page?: number; page?: number;
        };
        let data;
        type RunStatus = "completed" | "action_required" | "cancelled" | "failure" | "neutral" | "skipped" | "stale" | "success" | "timed_out" | "in_progress" | "queued" | "requested" | "waiting";
        if (workflow_id) {
          ({ data } = await octokit.rest.actions.listWorkflowRuns({
            owner, repo, workflow_id,
            status: status as RunStatus,
            per_page, page,
          }));
        } else {
          ({ data } = await octokit.rest.actions.listWorkflowRunsForRepo({
            owner, repo,
            status: status as RunStatus,
            per_page, page,
          }));
        }
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              total_count: data.total_count,
              workflow_runs: data.workflow_runs.map((run) => ({
                id: run.id,
                name: run.name,
                status: run.status,
                conclusion: run.conclusion,
                workflow: run.path,
                branch: run.head_branch,
                commit: run.head_sha.slice(0, 7),
                event: run.event,
                created_at: run.created_at,
                updated_at: run.updated_at,
                url: run.html_url,
              })),
            }, null, 2),
          }],
        };
      }

      case "get_authenticated_user": {
        const { data } = await octokit.rest.users.getAuthenticated();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              login: data.login,
              name: data.name,
              email: data.email,
              bio: data.bio,
              public_repos: data.public_repos,
              followers: data.followers,
              following: data.following,
              url: data.html_url,
            }, null, 2),
          }],
        };
      }

      case "list_user_repos": {
        const { username, type = "owner", sort = "updated", per_page = 10, page = 1 } = args as {
          username?: string; type?: "all" | "owner" | "member";
          sort?: "created" | "updated" | "pushed" | "full_name";
          per_page?: number; page?: number;
        };
        let data;
        if (username) {
          ({ data } = await octokit.rest.repos.listForUser({ username, type, sort, per_page, page }));
        } else {
          ({ data } = await octokit.rest.repos.listForAuthenticatedUser({ type, sort, per_page, page }));
        }
        return {
          content: [{
            type: "text",
            text: JSON.stringify(data.map((r) => ({
              full_name: r.full_name,
              description: r.description,
              private: r.private,
              stars: r.stargazers_count,
              language: r.language,
              default_branch: r.default_branch,
              updated_at: r.updated_at,
              url: r.html_url,
            })), null, 2),
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ── Start server ────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
