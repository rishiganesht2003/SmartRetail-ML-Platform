# backend/reports/utils/charts.py

import io
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]


def fig_to_png_bytes(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    buf.seek(0)
    data = buf.read()
    buf.close()
    return data


def sales_line_chart(months, sales, title="Sales Trend"):
    fig, ax = plt.subplots(figsize=(8, 3.5), dpi=100)
    ax.plot(months, sales, marker="o")
    ax.set_title(title)
    ax.set_ylabel("Revenue (₹)")
    ax.yaxis.set_major_formatter(FuncFormatter(lambda x, _: f"₹{int(x):,}"))
    ax.grid(alpha=0.3)
    data = fig_to_png_bytes(fig)
    plt.close(fig)
    return data
