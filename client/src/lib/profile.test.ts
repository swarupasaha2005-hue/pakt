// run: bun src/lib/profile.test.ts
import assert from "node:assert/strict";
import { profileErrors, type ProfileForm } from "./profile";

const ok: ProfileForm = { name: "Nova", avatar: "", x: "@nova_x", telegram: "", openToHire: true, fee: "20" };

assert.deepEqual(profileErrors(ok, false), {});
assert.ok(profileErrors(ok, true).avatar);
assert.ok(profileErrors({ ...ok, name: " " }, false).name);
for (const fee of ["9", "31", "20.5", "", "abc"]) assert.ok(profileErrors({ ...ok, fee }, false).fee, fee);
for (const fee of ["10", "30"]) assert.equal(profileErrors({ ...ok, fee }, false).fee, undefined);
assert.equal(profileErrors({ ...ok, openToHire: false, fee: "99" }, false).fee, undefined);
assert.ok(profileErrors({ ...ok, x: "has space" }, false).x);
assert.ok(profileErrors({ ...ok, telegram: "abc" }, false).telegram);
console.log("profile ok");
