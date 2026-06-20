import streamlit as st

from core.config import APP_INFO, ASSET_PATHS, GROUP_OPTIONS, default_year_options


def render_header(year_options: list[int | str] | None = None) -> tuple[int | str, str]:
    options = year_options or default_year_options()
    default_year_index = 1 if len(options) > 1 else 0

    st.markdown('<div class="app-hero">', unsafe_allow_html=True)
    col_title, col_year, col_group, col_logo = st.columns([5.2, 1.3, 1.6, 1.1])

    with col_title:
        st.markdown(
            """
            <div class="app-hero__eyebrow">Race Intelligence</div>
            <h1 class="app-hero__title">{title}</h1>
            <p class="app-hero__subtitle">{subtitle}</p>
            """.format(title=APP_INFO.title, subtitle=APP_INFO.subtitle),
            unsafe_allow_html=True,
        )

    with col_year:
        st.markdown('<div class="app-filter-card">', unsafe_allow_html=True)
        st.markdown('<p class="filter-label">Year</p>', unsafe_allow_html=True)
        selected_year = st.selectbox(
            "Year",
            options,
            index=default_year_index,
            key="year_filter",
            label_visibility="collapsed",
        )
        st.markdown('</div>', unsafe_allow_html=True)

    with col_group:
        st.markdown('<div class="app-filter-card">', unsafe_allow_html=True)
        st.markdown('<p class="filter-label">Group</p>', unsafe_allow_html=True)
        selected_group = st.selectbox(
            "Group",
            GROUP_OPTIONS,
            index=0,
            key="group_filter",
            label_visibility="collapsed",
        )
        st.markdown('</div>', unsafe_allow_html=True)

    with col_logo:
        st.markdown('<div class="app-logo-card">', unsafe_allow_html=True)
        if ASSET_PATHS.black_shirt_logo.exists():
            st.image(str(ASSET_PATHS.black_shirt_logo), width=108)
        st.markdown('<div class="app-logo-caption">Norseman</div>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

    st.markdown('</div>', unsafe_allow_html=True)
    return selected_year, selected_group
