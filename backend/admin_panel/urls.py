from django.urls import path
from .views import AdminSettingsView, UpdateAdminSettingsView

urlpatterns = [
    path('admin/settings/', AdminSettingsView.as_view(), name='api-admin-settings'),
    path('admin/settings/update/', UpdateAdminSettingsView.as_view(), name='api-admin-settings-update'),
]
