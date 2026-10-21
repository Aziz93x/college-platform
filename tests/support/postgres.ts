// The PostgreSQL image every test container runs. docker/compose.yml, docker/compose.dev.yml and CI
// name the same tag, and renovate.json updates every copy in one pull request.
export const POSTGRES_IMAGE = "postgres:18.6-alpine";
