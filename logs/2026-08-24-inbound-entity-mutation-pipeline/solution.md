
# Inbound Entity Mutation Pipeline Solution Architecture

## Target Architecture Overview

To solve the architectural boundary violations and remove legacy sync bottlenecks, LinkScribe implements the Inbound Entity Mutation Pipeline (IEMP). This system introduces strict encapsulation boundaries around DexieDB/IndexedDB persistence while establishing a dynamic strategy routing system for incoming local and remote mutations.

All data writes, whether triggered by user action in the UI layer or remote real-time backend pushes delivered via Durable Client Event Delivery (DCED), must flow exclusively through feature-scoped Mutation Apply Services. Direct database queries and writes from AppSyncService, components, or generic handlers are fully prohibited.

## Execution Workflow and Component Roles

When a local mutation occurs, the UI layer dispatches a standard Redux action without embedding persistence or network synchronization logic.

Custom Redux event bus middleware intercepts the dispatched action, extracts mutation metadata (entityType, operation, entityId, changes), and emits a typed event onto the central AppEventBus. Redux reducers remain purely functional state transformers, completely freed from `publishEvent()` calls or side-effect execution.

The App Driver layer listens to the event bus through ReduxEntityMutationRegister and immediately hands the generic payload over to the central EntityMutationRouter.

The EntityMutationRouter reads the payload's entityType tag and executes an O(1) strategy lookup against its dynamic internal handler registry. Centralized handler files containing monolithic switch statements are completely eliminated.

The resolved EntityMutationHandler (such as monolinkMutationHandler) takes over execution. It isolates feature logic and forwards execution directly into the feature's designated MonoLinkMutationApplyService, which serves as the sole authorized gateway to update local DexieDB/IndexedDB state and manage outbound synchronization queues.

For real-time backend updates received via WebSockets or SSE, AppSyncService no longer calls internal repository update methods like `applySharedLinksUpdate` or `applyMonoLinksUpdate`. Instead, it formats the incoming DCED event into the standardized entity mutation payload and hands it directly to the EntityMutationRouter, ensuring server-side updates observe the exact same persistence boundary rules as client-side mutations.

## Architectural Value

This architecture fully satisfies the Open-Closed Principle. New domains like Section or Notification register their own EntityMutationHandler independently with the router without modifying existing driver registries or global sync code. Persistence operations, offline queue management, and feature business rules remain cleanly isolated within their respective domain modules.