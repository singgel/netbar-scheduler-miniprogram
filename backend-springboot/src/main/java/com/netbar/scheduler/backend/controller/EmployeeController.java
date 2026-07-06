package com.netbar.scheduler.backend.controller;

import com.netbar.scheduler.backend.repository.SnapshotRepository;
import java.util.Collections;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class EmployeeController {

  private final SnapshotRepository snapshotRepository;

  public EmployeeController(SnapshotRepository snapshotRepository) {
    this.snapshotRepository = snapshotRepository;
  }

  @PostMapping("/api/employee/wechat/phone")
  public Map<String, Object> resolveWechatPhone(@RequestBody(required = false) Map<String, Object> body) {
    return snapshotRepository.resolveAccount(body == null ? Collections.emptyMap() : body);
  }
}
