# Loggie Core

Loggie Core is the local source of truth shared by the desktop companion, terminal sessions, and future Hikyaku message ingestion. Clients never open the database directly. They use the coordinator API so lifecycle rules, event ordering, and concurrent writes stay consistent.

## Milestone 0 boundaries

The first vertical slice persists five entities: projects, tasks, versioned briefs, sessions, and write-ups. It records an ordered domain event for every important mutation. Gmail credentials, window geometry, and terminal screen buffers remain outside the core.

The current implementation includes the domain lifecycle, SQLite storage, coordinator API, client library, Unix-socket lifecycle, Electron main-process startup, TUI session registration through `loggie --task <task-id>`, and a desktop work queue. The desktop can create projects and tasks, approve a deterministic first brief, launch Terminal, and refresh from ordered domain events.

## Lifecycle

Tasks follow this lifecycle:

```text
waiting -> briefed -> running -> done
                \        | \
                 \       |  -> blocked
                  ------> waiting
```

A task needs an approved brief before it can become `briefed`. A task can have only one active session. Completed tasks can be reopened as `waiting`.

Sessions follow this lifecycle:

```text
starting -> running <-> idle
    |          |          |
    |          +------> blocked
    |          |          |
    +----------+----------+--> failed
               +----------+--> completed
```

Terminal session states cannot be reopened after `failed` or `completed`. A write-up can only be created for a finished session.

## Storage

SQLite is run with foreign keys and WAL enabled. Schema version 1 creates:

- `projects`
- `tasks`
- `briefs`
- `sessions`
- `write_ups`
- `domain_events`
- `schema_migrations`

Source identity is unique across `(source_type, source_id)`, preventing the same Gmail thread from becoming duplicate tasks. Domain events use an increasing sequence so reconnecting clients can request everything after their last observed event.

## Security boundary

Only the trusted local coordinator process constructs `createCoreDatabase()`. Electron renderers go through validated IPC to the Electron main process, which uses the coordinator client. The production coordinator listens on a user-owned Unix domain socket with mode `0600`, rather than a public network interface.
