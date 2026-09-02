## Entity Mutation Router Registration

The `EntityMutationRouter` acts as the central router for incoming entity mutations. However, it requires the corresponding sync strategies or handler functions to be registered before it can process mutations.

This registration takes place during the application bootstrap process. The bootstrap code is not included in the current codebase provided here, so the following example illustrates how the router is initialized and how the feature-specific sync strategies are registered during application startup:

```ts
const entityMutationRouter = EntityMutationRouter.getInstance();

entityMutationRouter.register(monolinkSyncStrategy);
entityMutationRouter.register(sectionSyncStrategy);
```

Once the application has completed its bootstrap process, the registered strategies are available to the `EntityMutationRouter`, allowing it to dynamically resolve and execute the appropriate strategy based on the incoming entity mutation.

This registration-based approach keeps the router extensible: new entity types can introduce their own sync strategy and register it during application startup without requiring changes to the router's core implementation.
