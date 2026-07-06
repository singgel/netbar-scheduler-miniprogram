package com.netbar.scheduler.backend.config;

import java.nio.file.Path;
import java.nio.file.Paths;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class UploadConfig implements WebMvcConfigurer {

  private final String uploadDir;

  public UploadConfig(@Value("${app.upload-dir}") String uploadDir) {
    this.uploadDir = uploadDir;
  }

  @Override
  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
    String location = uploadPath.toUri().toString();
    if (!location.endsWith("/")) {
      location = location + "/";
    }
    registry.addResourceHandler("/uploads/**").addResourceLocations(location);
  }
}
