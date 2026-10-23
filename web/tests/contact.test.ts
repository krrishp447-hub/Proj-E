import { test } from "node:test";
import assert from "node:assert/strict";
import { aboutUrl, publicEmail, youtubeUrl } from "../src/lib/scout/contact.ts";

test("public email: business line wins, junk skipped, none when absent", () => {
  assert.equal(publicEmail(["Fan mail: fans@x.com\nFor business enquiries: Deals@TechGuy.in."]), "deals@techguy.in");
  assert.equal(publicEmail(["Mail me at me@gmail.com"]), "me@gmail.com");
  assert.equal(publicEmail(["logo@2x.png noreply@youtube.com", "Collab: hi@studio.co"]), "hi@studio.co");
  assert.equal(publicEmail(["No contact here", ""]), null);
});

test("channel links use the permanent channel id", () => {
  assert.equal(youtubeUrl("UCabc"), "https://www.youtube.com/channel/UCabc");
  assert.equal(aboutUrl("UCabc"), "https://www.youtube.com/channel/UCabc/about");
});
