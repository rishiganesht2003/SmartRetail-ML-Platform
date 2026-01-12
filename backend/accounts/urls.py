from django.urls import path
import accounts.views as views

urlpatterns = [
    # auth
    path("register/", views.RegisterView.as_view()),
    path("login/", views.RoleBasedTokenView.as_view()),
    path("profile/", views.profile_view),

    # 🔹 NEW – universal user info
    path("me/", views.me),

    # admin users
    path("users/", views.admin_users),
    path("users/<int:pk>/", views.admin_user_detail),

    # wallet
    path("wallet/", views.customer_wallet),
    path("wallet/topup/", views.wallet_topup),
]
