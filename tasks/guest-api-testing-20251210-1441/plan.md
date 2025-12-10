# Implementation Plan: Guest API Testing

## Objective

Create and execute a Postman Collection to verify Guest-facing API endpoints.

## Success Criteria

- [ ] Postman Collection JSON created (`guest_api_test.postman_collection.json`).
- [ ] Tests run successfully against local environment.
- [ ] "Create Booking" verified.
- [ ] "Get Booking" (via Token) verified.

## Architecture

- **Tool**: Postman (JSON) + Newman (CLI runner).
- **Environment**: Localhost:3000.

## Steps

1. **Start Server**: Ensure `next dev` is running on port 3000.
2. **Create Collection**: Define requests in JSON format.
3. **Execute**: Run `npx newman run` against the collection.
4. **Artifacts**: Save the collection and run report.
