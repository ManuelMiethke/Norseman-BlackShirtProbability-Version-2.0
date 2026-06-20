from layout import setup_page
from modules import empirical_pace
from modules import catchup
import footer

df_long, selected_year, selected_group = setup_page("Tools")

empirical_pace.render_13h_empirical_pace(selected_year, selected_group)
catchup.render_catchup(selected_year, selected_group)

footer.footer()
