"""
Power BI Template (.pbit) Generator
Creates minimal but valid Power BI template files.

.pbit files are Office Open XML packages with specific structure requirements.
"""
import io
import json
import zipfile
from datetime import datetime
from urllib.parse import urljoin


def generate_powerbi_template(backend_url: str) -> bytes:
    """
    Generate a minimal valid Power BI template (.pbit) file.
    
    Power BI templates require:
    - /Version: Text file with version info
    - [Content_Types].xml: MIME type registry
    - _rels/.rels: Package relationships
    - Report/metadata.json: Report settings
    - Model/metadata.json: Model settings
    
    Args:
        backend_url: Base URL of the backend (e.g., http://localhost:8000)
    
    Returns:
        Bytes of a valid .pbit file ready to download
    """
    
    powerbi_api_url = urljoin(backend_url, "/api/ml/forecasting/overview/?powerbi=1")
    
    # Create ZIP file (Power BI template format)
    pbit_buffer = io.BytesIO()
    
    with zipfile.ZipFile(pbit_buffer, 'w', zipfile.ZIP_DEFLATED) as pbit_zip:
        # 1. Version file (REQUIRED - must be at root with specific format)
        version_content = "2.120.0"
        pbit_zip.writestr('Version', version_content)
        
        # 2. [Content_Types].xml (REQUIRED for Office Open XML)
        content_types_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="json" ContentType="application/json"/>
  <Default Extension="txt" ContentType="text/plain"/>
  <Override PartName="/Report/metadata.json" ContentType="application/json"/>
  <Override PartName="/Report/definition.json" ContentType="application/json"/>
  <Override PartName="/Model/metadata.json" ContentType="application/json"/>
  <Override PartName="/Model/definition.json" ContentType="application/json"/>
</Types>'''
        pbit_zip.writestr('[Content_Types].xml', content_types_xml)
        
        # 3. _rels/.rels (REQUIRED - defines relationships)
        rels_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/office/2007/relationships/ui/extensibility" Target="Report/metadata.json"/>
  <Relationship Id="rId2" Type="http://schemas.microsoft.com/office/2007/relationships/ui/extensibility" Target="Model/metadata.json"/>
</Relationships>'''
        pbit_zip.writestr('_rels/.rels', rels_xml)
        
        # 4. Report/metadata.json
        report_metadata = {
            "version": 1,
            "name": "SmartRetail Analytics",
            "description": "Auto-generated Power BI template with 6 analytics modules"
        }
        pbit_zip.writestr('Report/metadata.json', json.dumps(report_metadata))
        
        # 5. Report/definition.json (minimal but valid)
        report_definition = {
            "version": "1.0",
            "sections": [
                {
                    "displayName": "SmartRetail Analytics Dashboard",
                    "visualContainers": []
                }
            ]
        }
        pbit_zip.writestr('Report/definition.json', json.dumps(report_definition))
        
        # 6. Model/metadata.json
        model_metadata = {
            "version": 1,
            "name": "SmartRetailModel",
            "description": "Data model with 12 tables from SmartRetail API",
            "dataSourceUrl": powerbi_api_url
        }
        pbit_zip.writestr('Model/metadata.json', json.dumps(model_metadata))
        
        # 7. Model/definition.json (minimal data model)
        model_definition = {
            "version": "1.0",
            "name": "SmartRetailModel",
            "tables": [
                {"name": "forecasting_overview", "displayName": "Sales Forecasting Overview"},
                {"name": "forecasting_series", "displayName": "Forecasting Series"},
                {"name": "inventory_overview", "displayName": "Inventory Overview"},
                {"name": "inventory_products", "displayName": "Inventory Products"},
                {"name": "pricing_overview", "displayName": "Pricing Overview"},
                {"name": "pricing_products", "displayName": "Pricing Products"},
                {"name": "recommendations_overview", "displayName": "Recommendations Overview"},
                {"name": "recommendations_products", "displayName": "Recommendations Products"},
                {"name": "segmentation_overview", "displayName": "Segmentation Overview"},
                {"name": "segmentation_customers", "displayName": "Segmentation Customers"},
                {"name": "seasonal_overview", "displayName": "Seasonal Overview"},
                {"name": "seasonal_daily_forecast", "displayName": "Seasonal Daily Forecast"}
            ]
        }
        pbit_zip.writestr('Model/definition.json', json.dumps(model_definition))
    
    pbit_buffer.seek(0)
    return pbit_buffer.getvalue()
