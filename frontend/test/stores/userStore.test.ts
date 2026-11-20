import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useUserStore, type UserDto } from "@/stores/userStore";

const FULL_USER: UserDto = {
  id: "user-123",
  username: "sudokufan",
  email: "fan@example.com",
  imageUrl: "https://example.com/avatar.png",
  currentPuzzleId: "puzzle-456",
  role: "admin",
};

const MINIMAL_USER: UserDto = {
  id: "user-789",
  email: "minimal@example.com",
  role: "user",
};

function expectEmpty(store: ReturnType<typeof useUserStore>) {
  expect(store.id).toBeUndefined();
  expect(store.username).toBeUndefined();
  expect(store.email).toBeUndefined();
  expect(store.imageUrl).toBeUndefined();
  expect(store.role).toBeUndefined();
  expect(store.currentPuzzleId).toBeUndefined();
}

describe("userStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("initial state", () => {
    it("starts with no user, not loading, and unauthenticated", () => {
      const store = useUserStore();

      expectEmpty(store);
      expect(store.loading).toBe(false);
      expect(store.isAuthenticated).toBe(false);
    });
  });

  describe("set", () => {
    it("populates every field from a full user", () => {
      const store = useUserStore();

      store.set(FULL_USER);

      expect(store.id).toBe(FULL_USER.id);
      expect(store.username).toBe(FULL_USER.username);
      expect(store.email).toBe(FULL_USER.email);
      expect(store.imageUrl).toBe(FULL_USER.imageUrl);
      expect(store.role).toBe(FULL_USER.role);
      expect(store.currentPuzzleId).toBe(FULL_USER.currentPuzzleId);
    });

    it("leaves optional fields undefined when they are omitted", () => {
      const store = useUserStore();

      store.set(MINIMAL_USER);

      expect(store.id).toBe(MINIMAL_USER.id);
      expect(store.email).toBe(MINIMAL_USER.email);
      expect(store.role).toBe("user");
      expect(store.username).toBeUndefined();
      expect(store.imageUrl).toBeUndefined();
      expect(store.currentPuzzleId).toBeUndefined();
    });

    it("clears optional fields from a previous user when set with a user lacking them", () => {
      const store = useUserStore();

      store.set(FULL_USER);
      store.set(MINIMAL_USER);

      expect(store.id).toBe(MINIMAL_USER.id);
      expect(store.email).toBe(MINIMAL_USER.email);
      expect(store.role).toBe("user");
      expect(store.username).toBeUndefined();
      expect(store.imageUrl).toBeUndefined();
      expect(store.currentPuzzleId).toBeUndefined();
    });

    it("does not change the loading flag", () => {
      const store = useUserStore();
      store.loading = true;

      store.set(FULL_USER);

      expect(store.loading).toBe(true);
    });

    it("does not keep a reference to the passed-in object", () => {
      const store = useUserStore();
      const user = { ...FULL_USER };

      store.set(user);
      user.username = "changed";

      expect(store.username).toBe(FULL_USER.username);
    });
  });

  describe("isAuthenticated", () => {
    it("becomes true once a user with an id is set", () => {
      const store = useUserStore();

      store.set(MINIMAL_USER);

      expect(store.isAuthenticated).toBe(true);
    });

    it("is false when the id is an empty string", () => {
      const store = useUserStore();

      store.set({ ...MINIMAL_USER, id: "" });

      expect(store.isAuthenticated).toBe(false);
    });

    it("reacts to direct changes of id", () => {
      const store = useUserStore();

      store.id = "abc";
      expect(store.isAuthenticated).toBe(true);

      store.id = undefined;
      expect(store.isAuthenticated).toBe(false);
    });

    it("becomes false after $reset", () => {
      const store = useUserStore();
      store.set(FULL_USER);

      store.$reset();

      expect(store.isAuthenticated).toBe(false);
    });
  });

  describe("$reset", () => {
    it("clears every user field and the loading flag", () => {
      const store = useUserStore();
      store.set(FULL_USER);
      store.loading = true;

      store.$reset();

      expectEmpty(store);
      expect(store.loading).toBe(false);
    });

    it("is safe to call on an already-empty store", () => {
      const store = useUserStore();

      expect(() => store.$reset()).not.toThrow();
      expectEmpty(store);
      expect(store.loading).toBe(false);
    });

    it("allows a new user to be set afterwards", () => {
      const store = useUserStore();
      store.set(FULL_USER);
      store.$reset();

      store.set(MINIMAL_USER);

      expect(store.id).toBe(MINIMAL_USER.id);
      expect(store.isAuthenticated).toBe(true);
    });
  });

  describe("store identity", () => {
    it("shares state between calls within the same pinia instance", () => {
      const a = useUserStore();
      const b = useUserStore();

      a.set(FULL_USER);

      expect(b.id).toBe(FULL_USER.id);
      expect(b.isAuthenticated).toBe(true);
    });

    it("does not leak state across pinia instances", () => {
      useUserStore().set(FULL_USER);

      setActivePinia(createPinia());
      const fresh = useUserStore();

      expectEmpty(fresh);
      expect(fresh.isAuthenticated).toBe(false);
    });
  });
});
