# Inbound Entity Mutation Pipeline Architecture Migration

## Background and Architectural Goal

The LinkScribe application is migrating away from the legacy MonoLink sync pipeline toward a modernized Inbound Entity Mutation Pipeline. The goal of this new architecture is to introduce strict boundary controls for database persistent operations (IndexedDB/DexieDB).

Under the new architectural rules, feature-level database write and read operations are strictly controlled. Direct reads and writes to DexieDB/IndexedDB from arbitrary services, third-party utilities, or UI layers are forbidden. All data mutations must pass explicitly through the feature-level Mutation Apply Service, which acts as the designated gateway to the persistence layer.

## The Problem: Legacy Architectural Violations

During the implementation of incoming real-time backend updates—specifically within the AppSyncService class—a key architectural boundary violation was identified.

When row-level database changes occur on the server, the Durable Client Event Delivery (DCED) system broadcasts update events down to the client via WebSockets or Server-Sent Events (SSE). Upon receiving these events, the client must apply updates to its local DexieDB state and Redux store.

In the legacy code, the AppSyncService handled these events using methods like `applySharedLinksUpdate` and `applyMonoLinksUpdate`. These methods bypassed architectural rules by performing direct write operations directly on the DexieDB repository outside of the MonoLinkMutationApplyService.

This legacy approach presented several core issues:

* Direct database updates occurred inside AppSyncService instead of routing through the feature's dedicated MonoLinkMutationApplyService.
* Redux reducers triggered direct side-effects by executing `publishEvent()` inside reducer logic.
* Events were processed by centralized, unmaintainable handlers using monolithic switch statements.
* Feature data was accessed and mutated by third-party functions without going through the central mutation pipeline.