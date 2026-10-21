# Proposed v1 Database Design

**Status: Proposed v1 design — pending final review.** This document combines confirmed product decisions with proposed conceptual entities and implementation constraints. The Prisma schema declares seven core-domain models plus the `Session` and `SessionRefreshToken` authentication models. The initial core-domain and session migrations were created, reviewed, and applied successfully; post-migration verification confirmed the expected domain structures and `StudyRoom` CHECK constraints. Authentication routes, PostgreSQL session persistence, Redis-backed rate limiting, and refresh transactions are implemented. Lobby queue/presence behavior and scheduled-room automation remain unimplemented.

The current Prisma schema at `apps/api/prisma/schema.prisma` declares seven core-domain models, two authentication persistence models, their relations, and partial indexes. The initial migrations have been applied, and post-migration verification confirmed the corresponding tables, indexes, and `StudyRoom` CHECK constraints. The project stack is NestJS, Prisma 7.10.1, PostgreSQL 17 for local development, and Redis. Redis currently backs distributed API rate-limit counters; its use for the planned live Lobby queue and transient presence is not implemented. Authentication APIs and session transactions are implemented, while room-domain APIs, scheduled-room jobs, and Lobby processing remain future work.

## 1. Design goals and storage choices

The core domain is relational: users own rooms, people join rooms, invitations and moderator assignments relate users to rooms, and ownership transfers have explicit participants and history. PostgreSQL provides foreign keys, uniqueness and check constraints, transactions, and concurrency controls that fit these relationships and integrity requirements.

MongoDB could represent this domain and may be suitable for other access patterns. It is not the default for this initial domain because its relationships and cross-record invariants are central to the design. This is a contextual choice, not a claim that SQL is universally superior to NoSQL.

PostgreSQL is the source of truth for users, rooms, memberships, authorization-related domain data, authentication sessions, and capacity enforcement. The approved architecture assigns Redis to the ephemeral live Lobby queue and transient connection/presence state; that Lobby use is not implemented. Redis is currently used for distributed request-rate counters. Queue state must never reserve a seat: admission is decided against PostgreSQL with concurrency-safe capacity enforcement.

The planned Lobby-specific PostgreSQL/Redis design means those systems can fail or disagree independently. Its eventual implementation must account for retries, stale queue entries, idempotent admission, reconnection, and recovery without treating Redis queue state as authoritative. These are design considerations, not completed features; the current Redis integration is for request-rate counters.

## 2. Core conceptual entities

The entities and fields below describe the conceptual core-domain model and are represented by model declarations in the Prisma schema. The initial core-domain migration has applied these structures to the database. Authentication persistence is described in the backend architecture documentation and is intentionally outside this conceptual model. `PK` means primary key and `FK` means foreign key.

### User

A user is an account identity. `User.id` is a stable UUID and remains in place for historical relationships even after anonymization. Email and username are normalized by trimming and lowercasing before storage and lookup; uniqueness applies to those normalized values. After anonymization, personal fields may be null, obsolete credentials are removed, and the original email and username are released for future registration. A new registration receives a new `User.id`.

Proposed fields:

- `id`: UUID primary key, retained through anonymization.
- `email`, `username`: normalized unique identity fields; nullable after anonymization.
- `passwordHash`: credential hash; removed or null after anonymization.
- `accountStatus`: `ACTIVE`, `DEACTIVATED`, or `ANONYMIZED`.
- `createdAt`, `updatedAt`.
- `deactivatedAt`, `anonymizeAt`: proposed timestamps useful for the approved deactivation workflow.

### StudyRoom

A room has one authoritative owner reference. `ownerId` determines ownership and Owner permissions. Ownership does not imply current participation: an owner may have no active `RoomMember` row.

Proposed fields:

- `id`: UUID primary key.
- `ownerId`: foreign key to `User` and authoritative source of ownership.
- `name`, optional `description`.
- `roomType`: `SCHEDULED` or `PERSISTENT`.
- `visibility`: `PUBLIC` or `PRIVATE`.
- `capacity`: total maximum number of admitted people, including the Owner and Moderators; minimum 2.
- `scheduledStartAt`, `scheduledEndAt`: required for Scheduled rooms and null for Persistent rooms.
- `status`, `createdAt`, `updatedAt`.

### RoomMember

`RoomMember` records participation for one membership period. It is not the authority for Owner or Moderator roles. A Lobby entry does not create membership. A row is created only after successful admission, including when the admitted person is an Owner or Moderator. Every later membership period gets a new row.

Proposed fields:

- `id`: surrogate UUID primary key.
- `roomId`, `userId`: foreign keys to `StudyRoom` and `User`.
- `joinedAt`.
- `leftAt`: nullable; `leftAt IS NULL` means this membership period is active.

There is deliberately **no `role` field** on `RoomMember`. A person can own a room without participating; the Owner's membership is created only on admission. A user's Moderator authority comes from `RoomModeratorAssignment`, whether or not they have an active membership. Keeping assignment separate from membership preserves the role when a Moderator leaves and prevents a membership period from becoming the source of authorization.

### RoomInvitation

An invitation grants a particular user access to a particular room. The recipient and the inviter are separate User relationships: `invitedUserId` identifies who may use the invitation, while `invitedById` records who created it.

Proposed fields:

- `id`: UUID primary key.
- `roomId`: foreign key to `StudyRoom`.
- `invitedUserId`: foreign key to the invited `User`.
- `invitedById`: foreign key to the inviting `User`.
- `status`: `PENDING`, `ACCEPTED`, `REVOKED`, or `EXPIRED`.
- `expiresAt`: optional timestamp; exact invitation expiry duration remains undecided.
- `createdAt`.

Allowed v1 transitions are `PENDING -> ACCEPTED`, `PENDING -> REVOKED`, and `PENDING -> EXPIRED`; other states are terminal. An invitation remains pending while its recipient waits in the Lobby and becomes accepted only after successful admission through that invitation. If revoked or expired while the recipient waits, it cannot authorize admission.

Repeated invitation history is retained, with at most one pending invitation per `(roomId, invitedUserId)`. Before creating a replacement, an expired pending row must be transitioned to `EXPIRED` through a concurrency-safe operation. Do not put a time-dependent expression such as `NOW()` in a partial-index predicate.

### RoomAccessCode

An access code is a reusable credential for one room. The stored value is a hash, not the raw access code. Keeping it separate from `RoomInvitation` captures the different grant semantics: a code can be reused by many users, while an invitation is bound to one recipient.

Proposed fields:

- `id`: UUID primary key.
- `roomId`: foreign key to `StudyRoom`.
- `createdById`: foreign key to the creating `User`.
- `codeHash`.
- `expiresAt`: optional timestamp.
- `revokedAt`: nullable timestamp; null means not revoked.
- `createdAt`.

A code may be used by multiple users, independently of invitations. Only the Owner may create, revoke, or regenerate it. There is at most one unrevoked code record per room at a time. Regeneration atomically revokes the previous code and creates the replacement. If a code has expired but remains unrevoked, mark it revoked before issuing a replacement when required by the uniqueness constraint. Generation/entropy, hashing details, rate limits, and final index strategy remain implementation details. Delivery mechanisms for invitations and codes are not specified or claimed to exist.

### RoomModeratorAssignment

Moderator authority is a separate room-scoped assignment, not a `RoomMember` role. The Owner appoints a Moderator; the assignment becomes active only after the proposed Moderator accepts. An active Moderator assignment remains valid even if the user leaves the room.

Proposed fields:

- `id`: UUID primary key.
- `roomId`: foreign key to `StudyRoom`.
- `userId`: foreign key to the assigned Moderator `User`.
- `assignedById`: foreign key to the assigning Owner `User`.
- `status`: `PENDING`, `ACTIVE`, `REVOKED`, `DECLINED`, `EXPIRED`, or `CANCELLED`.
- `assignedAt`, required `expiresAt` (set by the application to seven days after the request is created), optional `acceptedAt`, and optional `revokedAt`.

The request expires after 7 days if unanswered. The Owner may cancel a pending assignment. A reappointment creates a new historical row. At most one pending assignment and at most one active assignment may exist for a `(roomId, userId)` pair, using separate partial unique indexes. On account deactivation, active assignments are revoked. Reactivation during the account grace period does not restore them automatically; reassignment is required.

### OwnershipTransferRequest

Ownership transfer is a separate entity because it requires recipient acceptance and an auditable request lifecycle.

Proposed fields:

- `id`: UUID primary key.
- `roomId`: foreign key to `StudyRoom`.
- `requestedById`: foreign key to the current Owner `User`.
- `targetUserId`: foreign key to the proposed new Owner `User`.
- `status`: proposed values `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`, or `EXPIRED`.
- `createdAt`, `expiresAt`, optional `resolvedAt`.

The target must explicitly accept. A request expires after 7 days if unanswered; the current Owner may cancel a pending request. Only one pending transfer may exist per room. The exact state encoding and transition implementation remain implementation details, but acceptance must change ownership atomically. The former Owner loses Owner permissions and does not become a Moderator automatically. They remain an ordinary Member only if already holding an active membership; transfer never creates membership. Any active Moderator assignment held by the former Owner is revoked during transfer. The new Owner gains Owner permissions from `StudyRoom.ownerId` even before joining.

If a user chooses ownership transfer as part of account deletion, the transfer must complete before deactivation. The user can instead proceed with deletion without transferring.

## 3. Conceptual ERD

This Mermaid ERD is **conceptual and does not represent the complete physical database schema**. The Prisma schema declares the seven core-domain models plus two authentication persistence models. The initial migrations have been applied, and post-migration verification confirmed the expected structures. This ERD shows only the core-domain entities, UUID primary keys, foreign keys, and relationship cardinalities; it omits `Session` and `SessionRefreshToken`. It intentionally does not include a Lobby entity: Lobby queue behavior is planned for Redis but is not implemented.

```mermaid
erDiagram
    User ||--o{ StudyRoom : owns
    User ||--o{ RoomMember : participates
    StudyRoom ||--o{ RoomMember : has_membership_periods

    StudyRoom ||--o{ RoomInvitation : has_invitations
    User ||--o{ RoomInvitation : receives
    User ||--o{ RoomInvitation : creates

    StudyRoom ||--o{ RoomAccessCode : has_codes
    User ||--o{ RoomAccessCode : creates

    StudyRoom ||--o{ RoomModeratorAssignment : has_moderator_assignments
    User ||--o{ RoomModeratorAssignment : is_moderator
    User ||--o{ RoomModeratorAssignment : assigns

    StudyRoom ||--o{ OwnershipTransferRequest : has_transfer_requests
    User ||--o{ OwnershipTransferRequest : requests_transfer
    User ||--o{ OwnershipTransferRequest : is_transfer_target

    User {
        uuid id PK
        string email UQ_candidate "normalized; nullable after anonymization"
        string username UQ_candidate "normalized; nullable after anonymization"
        string passwordHash "nullable or removed after anonymization"
        string accountStatus "ACTIVE, DEACTIVATED, ANONYMIZED"
        datetime createdAt
        datetime updatedAt
        datetime deactivatedAt "optional"
        datetime anonymizeAt "optional"
    }

    StudyRoom {
        uuid id PK
        uuid ownerId FK
        string name
        string description "optional"
        string roomType "SCHEDULED or PERSISTENT"
        string visibility "PUBLIC or PRIVATE"
        int capacity "minimum 2"
        datetime scheduledStartAt "required for SCHEDULED; null for PERSISTENT"
        datetime scheduledEndAt "required for SCHEDULED; null for PERSISTENT"
        string status
        datetime createdAt
        datetime updatedAt
    }

    RoomMember {
        uuid id PK
        uuid roomId FK
        uuid userId FK
        datetime joinedAt
        datetime leftAt "nullable; null means active"
    }

    RoomInvitation {
        uuid id PK
        uuid roomId FK
        uuid invitedUserId FK
        uuid invitedById FK
        string status "PENDING, ACCEPTED, REVOKED, EXPIRED"
        datetime expiresAt "optional"
        datetime createdAt
    }

    RoomAccessCode {
        uuid id PK
        uuid roomId FK
        uuid createdById FK
        string codeHash
        datetime expiresAt "optional"
        datetime revokedAt "nullable"
        datetime createdAt
    }

    RoomModeratorAssignment {
        uuid id PK
        uuid roomId FK
        uuid userId FK
        uuid assignedById FK
        string status "PENDING, ACTIVE, REVOKED, DECLINED, EXPIRED, CANCELLED"
        datetime assignedAt
        datetime expiresAt
        datetime acceptedAt "optional"
        datetime revokedAt "optional"
    }

    OwnershipTransferRequest {
        uuid id PK
        uuid roomId FK
        uuid requestedById FK
        uuid targetUserId FK
        string status "proposed values; see entity description"
        datetime createdAt
        datetime expiresAt
        datetime resolvedAt "optional"
    }
```

Each request/assignment has one room and the named user references; a User or room may have zero or many historical rows. `StudyRoom.ownerId` identifies exactly one current owner per room. The `RoomMember` record represents a period of participation only; it does not duplicate Owner or Moderator role authority.

## 4. Room creation, types, and lifecycle

`roomType` describes the room operating model. `status` describes its current lifecycle state. **Start Now** and **Schedule for Later** are user-facing creation modes, not room types; there is no `INSTANT` room type.

| Creation mode | Initial `roomType` and `status` | Schedule fields | Behavior |
| --- | --- | --- | --- |
| **Start Now** | `PERSISTENT`, `ACTIVE` | Both `scheduledStartAt` and `scheduledEndAt` are null. | The Owner can enter immediately. Create a membership period only after successful admission. |
| **Schedule for Later** | `SCHEDULED`, `SCHEDULED` | Both are required; `scheduledEndAt` must be later than `scheduledStartAt`. | At `scheduledStartAt`, the backend automatically changes status to `ACTIVE` and attempts Lobby admission under authorization and capacity rules. |

`scheduledEndAt` is a planned end time, not an automatic shutdown. The room may remain active past that time, with an appropriate UI reminder. The Owner or a Moderator may end an active Scheduled session. The Owner disconnecting alone does not end it.

### Scheduled Room lifecycle

```text
SCHEDULED -> ACTIVE       (automatically at scheduledStartAt)
SCHEDULED -> CANCELLED    (if cancelled before start)
ACTIVE -> ENDED
```

When a Scheduled Room becomes `ENDED` or `CANCELLED`, close its active membership periods by setting `leftAt` as part of the same transaction as the room status update.

### Persistent Room lifecycle

```text
ACTIVE -> CLOSED
CLOSED -> ACTIVE
CLOSED -> ARCHIVED
```

`ARCHIVED` is terminal in v1. Archiving preserves the room record and membership history. When a Persistent Room becomes `CLOSED` or `ARCHIVED`, close active membership periods transactionally. Reopening a Persistent Room requires fresh admission and creates new membership-period records; prior rows remain history.

The Prisma schema declares enums for `roomType`, `visibility`, `status`, and `accountStatus`. The applied initial migration adds PostgreSQL `CHECK` constraints for capacity, scheduled/persistent timestamp rules, and room-type/status compatibility: Persistent rooms may use `ACTIVE`, `CLOSED`, or `ARCHIVED`; Scheduled rooms may use `SCHEDULED`, `ACTIVE`, `ENDED`, or `CANCELLED`. These CHECK constraints are present in migration SQL but are not represented in the Prisma schema, so schema changes must preserve them deliberately. Enum declarations alone do not enforce compatibility. Backend logic must additionally authorize actors and validate transitions; a valid stored status pair alone does not make a transition valid. A reliable mechanism for the scheduled transition at `scheduledStartAt` is still future work.

## 5. Membership, capacity, and administrator reservation

### Membership history

Each successful admission creates a new `RoomMember` period. Leaving sets `leftAt`; rejoining creates another row. A Lobby entry, failed admission, or room creation by itself creates no membership row. This applies equally to the Owner and Moderators: their role authority comes from `StudyRoom.ownerId` and `RoomModeratorAssignment`, while their admitted occupancy is represented by an active `RoomMember` period.

Enforce at most one active membership per `(roomId, userId)` with a PostgreSQL partial unique index on those columns where `leftAt IS NULL`. A plain unique constraint on `(roomId, userId)` would block all later membership-period rows after the first one, incorrectly preventing a user from rejoining. Historical rows with non-null `leftAt` remain available. This partial index is declared in the current Prisma schema using the `partialIndexes` preview feature and exists in the applied initial migration.

### Capacity and reserved administrator seat

`capacity` is the total maximum number of admitted people, including Owners and Moderators, and must be at least 2. Reserve one seat—not one seat per administrator—for an Owner or Moderator when no authorized administrator is currently present. Presence is the current in-room/connection state, distinct from an active moderator assignment or a membership period; transient presence belongs to Redis. While no administrator is present, an ordinary participant may not occupy the reserved final seat. An authorized Owner or Moderator may use it, subject to authorization, valid room lifecycle, and total capacity.

When the last authorized administrator leaves, reserve one seat again for future admission attempts. Do not eject participants already in the room; the reservation affects future admission decisions only. A room with `capacity = 1` could leave no seat for anyone but an administrator, so the confirmed `capacity >= 2` minimum supports one reserved administrative seat plus at least one other participant.

Capacity must be checked and enforced atomically in PostgreSQL. Counting active members and then inserting without concurrency control can oversubscribe a room when concurrent requests observe the same free seat. Use a transaction and appropriate room/seat locking or another justified atomic strategy; apply the same admission protocol to all paths. Redis queue order alone never guarantees a seat. FIFO priority applies among ordinary waiting users subject to the administrative reservation and all other authorization/admission rules.

## 6. Private Room access and authorization

For Private Rooms, admission policy is **Invitation OR Access Code**, not Invitation AND Code. An invitation is tied to one user and one room; a valid room code is an independent alternative and may authorize multiple users. Codes may expire and can be revoked. Join requests are out of scope for v1.

The backend checks private-room access server-side before Lobby entry and again when actual admission is attempted. Revalidate the relevant invitation or code, room lifecycle, current actor authorization, and capacity at admission time. A Redis queue entry or UI visibility is not an authorization grant.

### Confirmed permission model

| Operation | Owner | Moderator |
| --- | --- | --- |
| Appoint/remove Moderator | Yes | No |
| End active Scheduled session | Yes | Yes |
| Send/revoke invitations | Yes | Yes |
| Create/revoke/regenerate access code | Yes | No |
| Transfer ownership | Yes | No |
| Close/archive Persistent Room | Yes | No |

`StudyRoom.ownerId` determines Owner permissions; an active `RoomModeratorAssignment` determines Moderator permissions. Ordinary active participants have Member permissions. `RoomMember` is not the authority for roles.

## 7. Moderator assignment lifecycle

The Owner appoints a Moderator, but authority begins only when the target accepts. A pending assignment expires after 7 days if unanswered; the Owner may cancel it. Reappointment creates a new historical row. At most one pending and at most one active assignment may exist for a `(roomId, userId)` pair, enforced with separate partial unique indexes. An active assignment persists when its user leaves the room. Deactivating that account revokes active assignments; reactivation during the grace period does not restore them.

The schema enum declares `PENDING`, `ACTIVE`, `REVOKED`, `DECLINED`, `EXPIRED`, and `CANCELLED`. Acceptance moves a pending assignment to active; an Owner cancelling a pending request moves it to `CANCELLED`; removal or account deactivation revokes an active assignment; a recipient may decline; an unanswered request expires after 7 days. The application sets the required `expiresAt` to seven days after creation. Transition handling and expiry processing remain unimplemented design work.

## 8. Ownership transfer lifecycle

Only the current Owner can request transfer, and the target must explicitly accept. A request expires after 7 days if unanswered; the current Owner can cancel a pending request. At most one pending transfer request may exist per room. Accepting must atomically update `StudyRoom.ownerId` and resolve the request so there is no ambiguous owner. The former Owner loses Owner permissions, is not automatically made a Moderator, and remains an ordinary Member only if they already have an active membership. Revoke any active Moderator assignment held by the former Owner. The new Owner gains Owner permissions from `ownerId` whether or not they have joined.

Proposed request states are `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`, and `EXPIRED`; exact schema encoding and transition implementation remain to be finalized. If a user selects transfer as part of account deletion, transfer must complete before deactivation. If they proceed without transfer, deletion continues under the account lifecycle below.

## 9. Account deactivation, anonymization, and room effects

Account deletion is a user-requested workflow, not automatic inactivity. On request, deactivate the account and start a 30-day grace period. While deactivated, block login and normal authenticated operations; invalidate sessions/tokens in the future implementation. The user may reactivate during the grace period, cancelling anonymization. If they do not, anonymize personal data while preserving `User.id` and historical referential integrity. Release the original email and username for new registration; a new registration gets a new ID and does not reactivate the old identity. Remove or replace identifying fields and obsolete credentials according to a future retention implementation plan.

When deletion is requested, warn the Owner about rooms they own and offer optional ownership transfer first. If transfer completes, use the new Owner. If the user proceeds without transfer, cancel their not-yet-started Scheduled Rooms and close their Persistent Rooms; do not hard-delete rooms in v1. Retain room records and historical memberships, and invalidate invitations/access codes as appropriate for closed or archived rooms. End the deactivated user's active `RoomMember` periods and revoke active Moderator assignments. If the account is reactivated during the grace period, memberships and Moderator assignments do not return automatically; fresh admission and/or reassignment is required.

## 10. Integrity, indexes, and transactions

The following are required design invariants. The initial migration has been applied; post-migration verification confirmed the partial unique indexes and PostgreSQL `CHECK` constraints in the database. The `CHECK` constraints are not represented by the Prisma schema.

- `capacity >= 2`.
- Scheduled timestamps are both present and `scheduledEndAt > scheduledStartAt`; Persistent schedule fields are both null.
- Room status is valid for its room type, enforced by a proposed PostgreSQL `CHECK` in addition to backend transition validation.
- At most one active membership per `(roomId, userId)`, using a partial unique index where `leftAt IS NULL`.
- At most one pending invitation per `(roomId, invitedUserId)`, using a partial unique index on that pair where `status = 'PENDING'`; repeated history remains allowed.
- At most one unrevoked access code per room, using a partial unique index on `roomId` where `revokedAt IS NULL`. Regeneration atomically revokes old and creates new.
- At most one pending and one active Moderator assignment per `(roomId, userId)`, using separate partial unique indexes on that pair where `status = 'PENDING'` and `status = 'ACTIVE'`, respectively.
- At most one pending ownership transfer per room, using a partial unique index on `roomId` where `status = 'PENDING'`.
- An expired pending invitation, Moderator assignment, or transfer request must be transitioned before reissue where a partial unique index requires it. Do not use time-dependent predicates such as `NOW()` in index definitions.
- Admission and capacity checks are atomic; unprotected “count, then insert” is unsafe.
- Room status changes that close active memberships happen transactionally.
- Accepting ownership transfer atomically changes `ownerId` and request status.
- A database foreign key alone cannot ensure a matching Owner membership, and Owner membership is deliberately not required until the Owner is admitted. Do not add a `RoomMember.role` field; ownership and Moderator authority remain separate.

The application normalizes email and username by trimming and lowercasing before lookup and creation. PostgreSQL unique indexes enforce uniqueness for the stored values, including nullable identity fields. Those indexes do not themselves normalize direct database writes, so any future write path must follow the same normalization rule.

## 11. Lobby and Redis boundary

Do not add a PostgreSQL Lobby table. The approved architecture assigns Redis to the live waiting queue and transient connection/presence state; this Lobby behavior is not implemented. PostgreSQL remains authoritative for durable domain records and admission invariants. The current API uses Redis for distributed request-rate counters.

A user may request to join a Scheduled Room before its start. Validate access before placing them in the Lobby, then revalidate on admission. Lobby waiting is not membership. At automatic activation, attempt admission in FIFO order subject to authorization, current capacity, and the reserved administrator seat. If full, let the user keep waiting or leave and display a clear full-room message. FIFO gives priority, not a guaranteed seat. When a seat becomes available, attempt admission with concurrency-safe PostgreSQL enforcement.

Allow a 30-second reconnection grace period to retain queue position after a temporary disconnect. This duration is this product's decision, not a claim about Zoom or Google Meet. After expiry remove the user; a later rejoin enters at the queue end. v1 does not guarantee restoring queue position after Redis loss or restart, so affected users may need to rejoin. Queue retry, stale-entry recovery, idempotency, and PostgreSQL/Redis coordination are implementation considerations, not completed features.

## 12. Scope boundaries and unresolved implementation details

Out of the initial schema scope:

- Chat message persistence.
- WebRTC session/signaling data.
- Lobby queue and transient presence implementation (Redis is selected for this future behavior; current Redis usage is distributed request-rate counters).
- AI/RAG documents, chunks, embeddings, and evaluation data.
- Detailed notification delivery for invitations or access codes.

Still to finalize at implementation/design review:

- Exact invitation expiry duration.
- Access-code entropy/generation, hash approach, rate limits, and final indexing details.
- Exact background scheduling/repair mechanism and reliability/observability approach.
- Data-retention details beyond the agreed deactivation/anonymization policy and room-history retention.
- Notification/delivery implementation; this document does not imply one exists.

The fields and partial indexes are declared by the Prisma schema and applied initial migrations; PostgreSQL CHECK constraints are installed by migration SQL and are not represented in Prisma. Post-migration verification confirmed the expected database structures. Authentication APIs, session persistence, and Redis-backed rate limiting now exist in the backend; domain transaction requirements, Lobby processing, and background scheduling remain design guidance pending implementation. This design document makes no claim of production readiness.
