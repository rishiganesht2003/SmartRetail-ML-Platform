import io
import base64
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]


def fig_to_png_bytes(fig, tight=True):
    buf = io.BytesIO()
    if tight:
        fig.savefig(buf, format="png", bbox_inches="tight")
    else:
        fig.savefig(buf, format="png")
    buf.seek(0)
    data = buf.read()
    buf.close()
    return data


def sales_line_chart(months, sales, title="Sales Trend"):
    fig, ax = plt.subplots(figsize=(8,3.5), dpi=100)
    ax.plot(months, sales, marker="o", linewidth=2)
    ax.set_title(title)
    ax.set_xlabel("")
    ax.set_ylabel("Revenue (₹)")
    ax.yaxis.set_major_formatter(FuncFormatter(lambda x, _: f"₹{int(x):,}"))
    ax.grid(alpha=0.2)
    fig.tight_layout()
    data = fig_to_png_bytes(fig)
    plt.close(fig)
    return data


def generic_bar_chart(labels, values, title="", xlabel="", ylabel="", horiz=False):
    fig, ax = plt.subplots(figsize=(7,3.5), dpi=100)
    if horiz:
        ax.barh(labels, values)
    else:
        ax.bar(labels, values)
    ax.set_title(title)
    if ylabel:
        ax.set_ylabel(ylabel)
    fig.tight_layout()
    data = fig_to_png_bytes(fig)
    plt.close(fig)
    return data


def pie_chart(labels, values, title=""):
    fig, ax = plt.subplots(figsize=(5,4), dpi=100)
    ax.pie(values, labels=labels, autopct="%1.0f%%", startangle=90)
    ax.set_title(title)
    fig.tight_layout()
    data = fig_to_png_bytes(fig)
    plt.close(fig)
    return data
