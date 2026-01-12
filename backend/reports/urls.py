# backend/reports/urls.py

from django.urls import path
from reports import views

urlpatterns = [
    path("overview/", views.reports_overview),
    path("powerbi/export/", views.powerbi_export),
    path("export_excel/", views.export_excel),
    path("support/submit/", views.submit_support_ticket),
    path("support/", views.customer_my_tickets),
]
