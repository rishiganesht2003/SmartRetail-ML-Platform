# backend/settings.py

from pathlib import Path
from datetime import timedelta
import os

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = "django-insecure-#_y&(7ydbojvq7f9@+*hxua#1#fj32a0xqqom8y_!0+11m1wu("

DEBUG = True

ALLOWED_HOSTS = ["*"]

# =====================================================
# APPLICATIONS
# =====================================================
INSTALLED_APPS = [
    # Django core
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "rest_framework.authtoken",

    # Project apps (MINIMAL SET ✅)
    "accounts",
    "core",
    "catalog",
    "orders",
    "ml_engine",
    "reports",
]

# =====================================================
# MIDDLEWARE
# =====================================================
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

# =====================================================
# TEMPLATES
# =====================================================
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "django.template.context_processors.static",  # enable static() in templates
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# =====================================================
# DATABASE (MySQL)
# =====================================================
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": "smartretaildatabase",
        "USER": "smartuser",
        "PASSWORD": "smartretaildatabase",
        "HOST": "127.0.0.1",
        "PORT": "3306",
        "OPTIONS": {
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'"
        },
    }
}

# =====================================================
# PASSWORD VALIDATION (disabled for dev)
# =====================================================
AUTH_PASSWORD_VALIDATORS = []

# =====================================================
# INTERNATIONALIZATION
# =====================================================
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# =====================================================
# STATIC & MEDIA
# =====================================================
STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")            # for collectstatic target
STATICFILES_DIRS = [os.path.join(BASE_DIR, "static")]         # additional static source(s)

MEDIA_URL = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# =====================================================
# CORS
# =====================================================
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# =====================================================
# DRF
# =====================================================
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

# =====================================================
# JWT
# =====================================================
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),
}
