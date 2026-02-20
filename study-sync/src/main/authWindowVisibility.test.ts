/**
 * This file intentionally contains no runnable tests.
 *
 * Some environments/tools auto-discover `*.test.ts` files and try to run them
 * via Jest without TypeScript transforms, which causes noisy parse errors.
 *
 * The real tests for this module live in `authWindowVisibility.vitest.ts`.
 */

describe("authWindowVisibility (placeholder)", () => {
	it("does not fail Jest discovery", () => {
		expect(true).toBe(true);
	});
});
