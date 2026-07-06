package com.netbar.scheduler.backend.controller;

import com.netbar.scheduler.backend.repository.SnapshotRepository;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SnapshotController {

  private final SnapshotRepository snapshotRepository;

  public SnapshotController(SnapshotRepository snapshotRepository) {
    this.snapshotRepository = snapshotRepository;
  }

  @GetMapping("/api/snapshot")
  public Map<String, Object> getSnapshot() {
    return snapshotRepository.readSnapshot();
  }

  @PostMapping("/api/snapshot")
  public Map<String, Object> replaceSnapshot(@RequestBody Map<String, Object> snapshot) {
    snapshotRepository.replaceSnapshot(snapshot);
    return snapshotRepository.readSnapshot();
  }

  @PutMapping("/api/snapshot/{resource}")
  public ResponseEntity<Map<String, Object>> replaceSnapshotResource(
      @PathVariable String resource,
      @RequestBody Map<String, Object> body) {
    if (!SnapshotRepository.RESOURCE_NAMES.contains(resource)) {
      return message(HttpStatus.NOT_FOUND, "resource_not_found");
    }
    Object value = body == null ? null : body.get("value");
    snapshotRepository.replaceResource(resource, value);
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("ok", true);
    response.put(resource, snapshotRepository.readResource(resource));
    return ResponseEntity.ok(response);
  }

  @GetMapping("/api/{resource}")
  public ResponseEntity<Object> getResource(@PathVariable String resource) {
    if (!SnapshotRepository.RESOURCE_NAMES.contains(resource)) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND)
          .body(java.util.Collections.singletonMap("message", "resource_not_found"));
    }
    return ResponseEntity.ok(snapshotRepository.readResource(resource));
  }

  @PutMapping("/api/{resource}")
  public ResponseEntity<Object> replaceResource(
      @PathVariable String resource,
      @RequestBody Object body) {
    if (!SnapshotRepository.RESOURCE_NAMES.contains(resource)) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND)
          .body(java.util.Collections.singletonMap("message", "resource_not_found"));
    }
    Object value = body;
    if (body instanceof Map<?, ?> && ((Map<?, ?>) body).containsKey("value")) {
      value = ((Map<?, ?>) body).get("value");
    }
    snapshotRepository.replaceResource(resource, value);
    return ResponseEntity.ok(snapshotRepository.readResource(resource));
  }

  private ResponseEntity<Map<String, Object>> message(HttpStatus status, String message) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("message", message);
    return ResponseEntity.status(status).body(body);
  }
}
