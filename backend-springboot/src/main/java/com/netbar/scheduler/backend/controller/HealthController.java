package com.netbar.scheduler.backend.controller;

import java.util.Collections;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

  @GetMapping("/api/health")
  public Map<String, Boolean> health() {
    return Collections.singletonMap("ok", true);
  }
}
