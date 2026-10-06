import { Controller, Get } from "@nestjs/common";
import { manifest } from "./config.ts";

@Controller()
export class HealthController {
  @Get(manifest.api.health)
  health() {
    return { ok: true };
  }
}
