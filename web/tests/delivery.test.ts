import { test } from "node:test";
import assert from "node:assert/strict";
import { googleDriveUrl, parseDeliverables, stageFromDelivery, youtubeVideoId } from "../src/lib/scout/delivery.ts";

test("agreed deliverables text becomes items", () => {
  assert.deepEqual(parseDeliverables("1 YouTube video + 2 Shorts"), ["YouTube video", "YouTube Short", "YouTube Short"]);
  assert.deepEqual(parseDeliverables("Dedicated video and three shorts"), ["YouTube video", "YouTube Short", "YouTube Short", "YouTube Short"]);
  assert.deepEqual(parseDeliverables("integration in my next upload"), ["YouTube video"]);
  assert.deepEqual(parseDeliverables("something custom"), ["YouTube video"]); // always something to track
  assert.equal(parseDeliverables("50 shorts").length, 10); // capped
});

test("video ids from every YouTube link shape, nothing from others", () => {
  for (const u of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ?t=3", "https://youtube.com/shorts/dQw4w9WgXcQ",
    "https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ", "youtube.com/live/dQw4w9WgXcQ"]) assert.equal(youtubeVideoId(u), "dQw4w9WgXcQ", u);
  assert.equal(youtubeVideoId("https://instagram.com/p/abc"), null);
  assert.equal(youtubeVideoId("https://youtu.be/short"), null);
});

test("deal stage follows delivery, forward only", () => {
  assert.equal(stageFromDelivery("Contracted", ["Planned", "Planned"]), "Contracted");
  assert.equal(stageFromDelivery("Contracted", ["Live", "Planned"]), "In production");
  assert.equal(stageFromDelivery("In production", ["Live", "Approved"]), "Live");
  assert.equal(stageFromDelivery("Live", ["Paid", "Paid"]), "Paid");
  assert.equal(stageFromDelivery("Paid", ["Live"]), "Paid"); // never backwards
  assert.equal(stageFromDelivery("Negotiating", ["Live"]), "Negotiating"); // only after contract
});

test("draft links: Google Drive / Docs over https only", () => {
  assert.equal(googleDriveUrl("https://drive.google.com/file/d/1AbC/view?usp=sharing"), "https://drive.google.com/file/d/1AbC/view?usp=sharing");
  assert.ok(googleDriveUrl(" https://docs.google.com/document/d/xyz/edit "));
  assert.equal(googleDriveUrl("http://drive.google.com/file/d/1"), null); // not https
  assert.equal(googleDriveUrl("https://drive.google.com.evil.example/x"), null); // look-alike host
  assert.equal(googleDriveUrl("https://dropbox.com/s/abc"), null);
  assert.equal(googleDriveUrl("not a link"), null);
});
