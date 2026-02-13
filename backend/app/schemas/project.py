from pydantic import BaseModel, Field


class SupportLink(BaseModel):
    label: str = Field(max_length=200)
    url: str = Field(max_length=2000)


class PartItem(BaseModel):
    name: str = Field(max_length=200)
    quantity: int = Field(default=1, ge=1, le=10000)
    description: str | None = Field(default=None, max_length=1000)
    buyLink: str | None = Field(default=None, max_length=2000)
    price: str | None = Field(default=None, max_length=50)


class DownloadItem(BaseModel):
    name: str = Field(max_length=200)
    url: str = Field(max_length=2000)
    size: str | None = Field(default=None, max_length=50)
    type: str = Field(default="other", max_length=20)


class CircuitData(BaseModel):
    src: str = Field(max_length=2000)
    alt: str | None = Field(default=None, max_length=500)
    downloadUrl: str | None = Field(default=None, max_length=2000)


class BuildStep(BaseModel):
    title: str = Field(max_length=500)
    content: str = Field(max_length=50000)  # HTML
    warning: str | None = Field(default=None, max_length=2000)


class FirmwareData(BaseModel):
    name: str = Field(max_length=200)
    version: str = Field(max_length=50)
    price: float = Field(ge=0, le=99999.99)
    currency: str = Field(default="USD", max_length=10)
    features: list[str] = Field(default_factory=list)
    firmwareUrl: str | None = Field(default=None, max_length=2000)
    sourceCodeUrl: str | None = Field(default=None, max_length=2000)
    variantId: str | None = Field(default=None, max_length=50)


class AppData(BaseModel):
    name: str = Field(max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    playStoreUrl: str | None = Field(default=None, max_length=2000)
    apkUrl: str | None = Field(default=None, max_length=2000)
    apkVersion: str | None = Field(default=None, max_length=50)
    apkSize: str | None = Field(default=None, max_length=50)
    iosUrl: str | None = Field(default=None, max_length=2000)
    features: list[str] = Field(default_factory=list)


class SupportData(BaseModel):
    text: str | None = Field(default=None, max_length=5000)
    links: list[SupportLink] = Field(default_factory=list)


class ProjectCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=2000)
    tags: str = Field(default="", max_length=500)
    youtube_id: str | None = Field(default=None, max_length=11, pattern=r"^[a-zA-Z0-9_-]{11}$")
    overview: str | None = Field(default=None, max_length=100000)
    parts: list[PartItem] | None = None
    downloads: list[DownloadItem] | None = None
    circuit: CircuitData | None = None
    build_guide: list[BuildStep] | None = None
    firmware: FirmwareData | None = None
    app: AppData | None = None
    support: SupportData | None = None
    is_published: bool = False


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    tags: str | None = Field(default=None, max_length=500)
    youtube_id: str | None = Field(default=None, max_length=11, pattern=r"^[a-zA-Z0-9_-]{11}$")
    overview: str | None = Field(default=None, max_length=100000)
    parts: list[PartItem] | None = None
    downloads: list[DownloadItem] | None = None
    circuit: CircuitData | None = None
    build_guide: list[BuildStep] | None = None
    firmware: FirmwareData | None = None
    app: AppData | None = None
    support: SupportData | None = None
    is_published: bool | None = None


class ProjectResponse(BaseModel):
    id: int
    slug: str
    name: str
    description: str
    tags: str
    youtube_id: str | None = None
    overview: str | None = None
    parts: list[PartItem] | None = None
    downloads: list[DownloadItem] | None = None
    circuit: CircuitData | None = None
    build_guide: list[BuildStep] | None = None
    firmware: FirmwareData | None = None
    app: AppData | None = None
    support: SupportData | None = None
    is_published: bool
