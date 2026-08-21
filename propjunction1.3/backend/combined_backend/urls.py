"""
Combined Backend URL Configuration.

Routes:
  /admin/                  - Django admin
  /api/712/...             - 7/12 Bhulekh scraper endpoints
  /api/8a/...              - 8A Khata scraper endpoints
  /api/igr/...             - IGR History scraper endpoints
  /                        - Home page (unified dashboard)
"""
from django.contrib import admin
from django.urls import path, include
from django.shortcuts import render


def home(request):
    """Unified dashboard landing page."""
    return render(request, 'index.html')


urlpatterns = [
    path('admin/', admin.site.urls),

    # 7/12 scraper API - same endpoints as original (port 8001)
    path('api/712/', include('scraper_712.bhulekh_app.urls')),

    # 8A scraper API - same endpoints as original (port 8002)
    path('api/8a/', include('scraper_8a.bhulekh_app.urls')),

    # IGR History scraper API - same endpoints as original
    path('api/igr/', include('scraper_igr.igr_api.urls')),

    # Home page
    path('', home, name='home'),
]
