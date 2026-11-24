import { beforeEach, describe, expect, it } from "vitest";
import { isNavigationFailure, NavigationFailureType } from "vue-router";
import router, { PUZZLE_DIFFICULTY_ROUTES } from "@/router";
import { DIFFICULTY_RATINGS } from "@/stores/gameStore";

// This drives the real router. Its beforeEnter guard only runs when entering
// the sudoku route from another route; switching difficulty while already on
// it is handled by Standard.vue's onBeforeRouteUpdate (tested in
// Standard.test.ts).
describe("router", () => {
  beforeEach(async () => {
    await router.push({ name: "home" });
  });

  it("only offers difficulties the game store knows about", () => {
    for (const difficulty of PUZZLE_DIFFICULTY_ROUTES) {
      expect(DIFFICULTY_RATINGS).toContain(difficulty);
    }
  });

  it.each(["beginner", "easy", "medium", "hard"])("opens the %s puzzle", async (difficulty) => {
    const failure = await router.push(`/sudoku/${difficulty}`);

    expect(failure).toBeUndefined();
    expect(router.currentRoute.value.name).toBe("sudoku");
    expect(router.currentRoute.value.params.difficulty).toBe(difficulty);
  });

  // `impossible` is a real difficulty rating, but it isn't playable yet.
  it.each(["impossible", "foo", "HARD", "hard%20", "0"])(
    "blocks /sudoku/%s and stays where it was",
    async (difficulty) => {
      const failure = await router.push(`/sudoku/${difficulty}`);

      expect(isNavigationFailure(failure, NavigationFailureType.aborted)).toBe(true);
      expect(router.currentRoute.value.name).toBe("home");
    },
  );

  it("passes the difficulty to the page as a prop", () => {
    const sudoku = router.getRoutes().find((r) => r.name === "sudoku")!;

    expect(sudoku.props.default).toBe(true);
  });
});
