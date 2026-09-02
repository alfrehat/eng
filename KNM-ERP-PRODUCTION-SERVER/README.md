# Enterprise Government ERP Platform (v2.0)

## Overview
This is the root repository for the enterprise government ERP platform built on a Clean Architecture and CQRS structure. 

## Structure
*   `src/Core`: Contains Domain and Application logic.
*   `src/Infrastructure`: Contains Persistence (Entity Framework) and Shared infrastructure services.
*   `src/Presentation`: Contains the API Gateway and main REST Web APIs.
*   `src/Modules`: Contains independent modules (e.g., Admin, Identity) injected dynamically.
*   `tests`: Contains xUnit test projects for Unit, Integration, and Architecture verification.
*   `deploy`: Docker and Helm chart manifests.
*   `docs`: Technical documentation and Architectural Decision Records (ADRs).

## Getting Started
(To be updated with build and execution instructions).
