package com.mediflow.prescription.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class AppConfig {

    @Value("${medication-catalog.url}")
    private String medicationCatalogUrl;

    @Value("${message-broker.url}")
    private String messageBrokerUrl;

    @Bean
    public RestClient catalogRestClient() {
        return RestClient.builder()
                .baseUrl(medicationCatalogUrl)
                .build();
    }

    @Bean
    public RestClient brokerRestClient() {
        return RestClient.builder()
                .baseUrl(messageBrokerUrl)
                .build();
    }
}
