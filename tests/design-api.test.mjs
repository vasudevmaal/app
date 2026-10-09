import test from "node:test";
import assert from "node:assert/strict";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const base = process.env.TEST_URL;
test(
  "design projects, owner presets, access controls and export formats",
  { skip: !base },
  async () => {
    const call = (route, data, method = "POST", cookie = "") =>
      fetch(`${base}/api/${route}`, {
        method,
        headers: { cookie, "Content-Type": "application/json" },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
    const login = await call("auth/login", {
      email: "owner@excpix.com",
      password: "12345678",
    });
    assert.equal(login.status, 200);
    const owner = login.headers.get("set-cookie").split(";")[0];
    const styles = await (await call("styles", undefined, "GET")).json();
    const style = styles.find(
      (s) => s.kind === "design" && s.is_free && !s.is_premium,
    );
    assert.ok(style);
    const presets = await (
      await call("creative-library", undefined, "GET")
    ).json();
    const project = {
      name: "Design QA",
      canvasW: 600,
      canvasH: 400,
      bg: { type: "solid", color: "#ffffff" },
      elements: [
        {
          id: "a",
          type: "text",
          text: "DESIGN",
          x: 60,
          y: 100,
          w: 400,
          h: 80,
          groupId: "pair",
          fillType: "radial",
          gradient: {
            stops: [
              { color: "#ff0000", pos: 0 },
              { color: "#00ff00", pos: 50 },
              { color: "#0000ff", pos: 100 },
            ],
          },
        },
      ],
    };
    let projectId;
    try {
      assert.equal(
        (await call("design/projects", undefined, "GET")).status,
        401,
      );
      assert.equal((await call("creative-library", presets)).status, 403);
      assert.equal(
        (await call("creative-library", presets, "POST", owner)).status,
        200,
      );
      assert.equal(
        (
          await call(
            "creative-library",
            [...presets, presets[0]],
            "POST",
            owner,
          )
        ).status,
        400,
      );
      const saved = await call(
        "design/projects",
        { style_id: style.id, content_json: project },
        "POST",
        owner,
      );
      assert.equal(saved.status, 200, await saved.clone().text());
      projectId = (await saved.json()).id;
      const records = await (
        await call("design/projects", undefined, "GET", owner)
      ).json();
      const record = records.find((p) => p.id === projectId);
      assert.equal(record.content_json.elements[0].locked, false);
      assert.equal(record.content_json.elements[0].groupId, "pair");
      assert.equal(record.content_json.elements[0].gradient.stops.length, 3);
      const otherLogin = await call("auth/register", {
        name: "Design QA",
        email: `design-qa-${Date.now()}@example.test`,
        password: "test-password-2026",
      });
      assert.equal(otherLogin.status, 200);
      const other = otherLogin.headers.get("set-cookie").split(";")[0];
      assert.equal(
        (await call("creative-library", presets, "POST", other)).status,
        403,
      );
      assert.equal(
        (
          await call(
            "design/projects",
            { id: projectId, style_id: style.id, content_json: project },
            "POST",
            other,
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await call("design/projects", undefined, "GET", other).then((r) =>
            r.json(),
          )
        ).length,
        0,
      );
      const bitmap = createCanvas(600, 400),
        ctx = bitmap.getContext("2d");
      ctx.fillStyle = "#f05a41";
      ctx.fillRect(0, 0, 600, 400);
      const output = {
        style_id: style.id,
        content_json: project,
        quality: 600,
        image: bitmap.toDataURL("image/png"),
      };
      assert.equal(
        (
          await call(
            "design/export",
            { ...output, quality: 7680, format: "png" },
            "POST",
            other,
          )
        ).status,
        400,
      );
      for (const format of ["png", "jpeg", "webp", "pdf"]) {
        const response = await call(
          "design/export",
          { ...output, format },
          "POST",
          owner,
        );
        assert.equal(response.status, 200, await response.clone().text());
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.ok(bytes.length > 200);
        if (format === "pdf")
          assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
        else {
          const image = await loadImage(bytes);
          assert.equal(image.width, 600);
          assert.equal(image.height, 400);
        }
      }
      const cross = await fetch(`${base}/api/design/projects`, {
        method: "POST",
        headers: {
          cookie: owner,
          Origin: "https://other.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ style_id: style.id, content_json: project }),
      });
      assert.equal(cross.status, 403);
    } finally {
      await call("creative-library", presets, "POST", owner);
      if (projectId)
        await call("design/projects", { id: projectId }, "DELETE", owner);
    }
  },
);
