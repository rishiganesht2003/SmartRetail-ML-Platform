# backend/accounts/urls.py
from django.urls import path
from .views import (
    RegisterView, RoleBasedTokenView, protected,
    my_profile, change_password,
    admin_users_list_create, admin_user_detail
)

urlpatterns = [
    path("register/", RegisterView.as_view()),
    path("login/", RoleBasedTokenView.as_view()),
    path("protected/", protected),

    # profile & password
    path("profile/", my_profile),              # GET, PATCH
    path("change_password/", change_password), # POST

    # admin manage users
    path("users/", admin_users_list_create),         # GET, POST
    path("users/<int:pk>/", admin_user_detail),     # GET, PATCH, DELETE
]
