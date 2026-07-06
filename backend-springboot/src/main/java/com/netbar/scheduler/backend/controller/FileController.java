package com.netbar.scheduler.backend.controller;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
public class FileController {

  private final String uploadDir;

  public FileController(@Value("${app.upload-dir}") String uploadDir) {
    this.uploadDir = uploadDir;
  }

  @PostMapping("/api/files/avatar")
  public Map<String, Object> uploadAvatar(@RequestParam("file") MultipartFile file) throws IOException {
    if (file == null || file.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "empty_file");
    }
    String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
    if (!contentType.startsWith("image/")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "avatar_must_be_image");
    }

    String extension = extensionFor(contentType, file.getOriginalFilename());
    Path avatarDir = Paths.get(uploadDir, "avatars").toAbsolutePath().normalize();
    Files.createDirectories(avatarDir);
    String fileName = UUID.randomUUID() + extension;
    Path target = avatarDir.resolve(fileName).normalize();
    Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

    String path = "/uploads/avatars/" + fileName;
    String url = ServletUriComponentsBuilder.fromCurrentContextPath().path(path).toUriString();
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("url", url);
    result.put("path", path);
    return result;
  }

  private String extensionFor(String contentType, String originalFilename) {
    if ("image/jpeg".equals(contentType) || "image/jpg".equals(contentType)) return ".jpg";
    if ("image/png".equals(contentType)) return ".png";
    if ("image/webp".equals(contentType)) return ".webp";
    if ("image/gif".equals(contentType)) return ".gif";
    String name = originalFilename == null ? "" : originalFilename.toLowerCase(Locale.ROOT);
    int dot = name.lastIndexOf('.');
    if (dot >= 0 && dot < name.length() - 1) {
      String extension = name.substring(dot);
      if (extension.matches("\\.[a-z0-9]{1,8}")) return extension;
    }
    return ".jpg";
  }
}
