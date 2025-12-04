from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import AutomationModule, AutomationStats


class AutomationCenterView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        modules = AutomationModule.objects.all().order_by("id")
        stats = AutomationStats.objects.first()

        return Response({
            "modules": [
                {
                    "id": m.id,
                    "name": m.name,
                    "key": m.key,
                    "description": m.description,
                    "active": m.is_active,
                    "accuracy": m.accuracy,
                    "impact": m.weekly_impact,
                }
                for m in modules
            ],
            "stats": {
                "uptime": stats.uptime if stats else 0,
                "hours_saved": stats.hours_saved if stats else 0,
                "next_retrain_days": stats.next_retrain_days if stats else 0,
            }
        })


class AutomationToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        module_id = request.data.get("module_id")

        try:
            m = AutomationModule.objects.get(id=module_id)
        except AutomationModule.DoesNotExist:
            return Response({"error": "Module not found"}, status=404)

        m.is_active = not m.is_active
        m.save()

        return Response({
            "message": "Updated",
            "module_id": m.id,
            "active": m.is_active,
        })
