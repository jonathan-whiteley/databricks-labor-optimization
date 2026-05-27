"""Environment-driven configuration. The app is re-skinnable via these vars."""
import os
from functools import lru_cache
from pydantic import BaseModel


class Settings(BaseModel):
    catalog: str = os.getenv("CATALOG", "jdub_demo")
    brand_schema: str = os.getenv("BRAND_SCHEMA", "panda")
    lakebase_host: str = os.getenv(
        "LAKEBASE_HOST",
        "ep-icy-star-d1twxm2q.database.us-west-2.cloud.databricks.com",
    )
    lakebase_database: str = os.getenv("LAKEBASE_DATABASE", "panda_labor")
    lakebase_pg_schema: str = os.getenv("LAKEBASE_PG_SCHEMA", "panda")
    lakebase_instance: str = os.getenv("LAKEBASE_INSTANCE_NAME", "panda-labor-db")
    serving_endpoint: str = os.getenv(
        "SERVING_ENDPOINT_NAME", "dev_jonathan_whiteley_panda-labor-rec-v1"
    )
    user_email: str = os.getenv("USER_EMAIL", "jonathan.whiteley@databricks.com")
    genie_space_id: str = os.getenv(
        "GENIE_SPACE_ID", "01f14e48463113eda51eff62f704947a"
    )


@lru_cache
def settings() -> Settings:
    return Settings()
